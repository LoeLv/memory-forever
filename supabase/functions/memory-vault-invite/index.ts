import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ownerSecret = Deno.env.get("MEMORY_VAULT_OWNER_SECRET") ?? "";
const bucketName = Deno.env.get("MEMORY_VAULT_BUCKET") ?? "memories";

class InviteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

console.info("memory-vault-invite started");

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req, ctx) => {
      if (req.method === "OPTIONS") {
        return json({ ok: true });
      }
      if (req.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
      }

      const admin = ctx.supabaseAdmin;

      try {
        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("multipart/form-data")) {
          const form = await req.formData();
          const action = String(form.get("action") || "");
          if (action === "uploadMemory") return uploadMemoryForm(admin, form);
          return json(
            { error: "Multipart requests only support uploadMemory" },
            400,
          );
        }

        const body = (await req.json()) as JsonRecord;
        const action = String(body.action || "");

        if (action === "checkInvite") return checkInvite(admin, body);
        if (action === "createInvite") return createInvite(admin, body);
        if (action === "listInvites") return listInvites(admin, body);
        if (action === "revokeInvite") return revokeInvite(admin, body);

        return json({ error: "Unknown action" }, 400);
      } catch (error) {
        if (error instanceof InviteError) {
          return json({ error: error.message }, error.status);
        }
        console.error(error);
        return json({ error: "Server error" }, 500);
      }
    },
  ),
};

function json(payload: JsonRecord, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function requireOwner(body: JsonRecord) {
  if (!ownerSecret) {
    throw new Error("Owner secret is not configured");
  }
  if (String(body.ownerSecret || "") !== ownerSecret) {
    throw new Error("Owner secret is wrong");
  }
}

async function checkInvite(admin: any, body: JsonRecord) {
  const token = String(body.token || "");
  const invite = await findInvite(admin, token);
  return json({ invite: publicInvite(invite) });
}

async function createInvite(admin: any, body: JsonRecord) {
  try {
    requireOwner(body);
  } catch (error) {
    return json({ error: errorMessage(error) }, 401);
  }

  const name = String(body.name || "受邀上传").slice(0, 80);
  const expiresInHours = clamp(Number(body.expiresInHours || 72), 1, 720);
  const expiresAt = new Date(
    Date.now() + expiresInHours * 60 * 60 * 1000,
  ).toISOString();
  const token =
    crypto.randomUUID().replaceAll("-", "") +
    crypto.randomUUID().replaceAll("-", "");

  const { data, error } = await admin
    .from("upload_invites")
    .insert({ token, name, expires_at: expiresAt })
    .select("id, token, name, used_count, expires_at, revoked_at, created_at")
    .single();

  if (error) {
    console.error(error);
    return json({ error: "Failed to create invite" }, 500);
  }

  return json({ token, invite: data });
}

async function listInvites(admin: any, body: JsonRecord) {
  try {
    requireOwner(body);
  } catch (error) {
    return json({ error: errorMessage(error) }, 401);
  }

  const { data, error } = await admin
    .from("upload_invites")
    .select("id, token, name, used_count, expires_at, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    return json({ error: "Failed to list invites" }, 500);
  }

  return json({ invites: data || [] });
}

async function revokeInvite(admin: any, body: JsonRecord) {
  try {
    requireOwner(body);
  } catch (error) {
    return json({ error: errorMessage(error) }, 401);
  }

  const id = String(body.id || "");
  if (!id) return json({ error: "Missing invite id" }, 400);

  const { error } = await admin
    .from("upload_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error(error);
    return json({ error: "Failed to revoke invite" }, 500);
  }

  return json({ ok: true });
}

async function uploadMemoryForm(admin: any, form: FormData) {
  const token = String(form.get("token") || "");
  const invite = await findInvite(admin, token);
  const file = form.get("file");

  if (!(file instanceof File)) {
    return json({ error: "Missing image file" }, 400);
  }

  const fileName = sanitizeFileName(file.name || "memory.jpg");
  const fileType = file.type || "image/jpeg";
  if (!fileType.startsWith("image/")) {
    return json({ error: "Only image uploads are allowed" }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > 10 * 1024 * 1024) {
    return json({ error: "File is larger than 10MB" }, 400);
  }

  const path = `invited/${invite.id}/${Date.now()}-${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await admin.storage
    .from(bucketName)
    .upload(path, bytes, {
      contentType: fileType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    return json({ error: "Failed to upload image" }, 500);
  }

  const { data: publicUrlData } = admin.storage
    .from(bucketName)
    .getPublicUrl(path);
  const description = buildDescription(
    String(form.get("description") || ""),
    String(form.get("source") || ""),
    invite.name || "",
  );
  const title =
    String(form.get("title") || "")
      .trim()
      .slice(0, 80) || fileName.replace(/\.[^.]+$/, "");

  const { data: photo, error: insertError } = await admin
    .from("photos")
    .insert({
      title,
      description,
      image_url: publicUrlData.publicUrl,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    console.error(insertError);
    return json({ error: "Failed to save memory" }, 500);
  }

  await admin
    .from("upload_invites")
    .update({
      used_count: Number(invite.used_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  return json({ photo });
}

async function findInvite(admin: any, token: string) {
  if (!token) throw new InviteError("Missing invite token", 400);
  const { data, error } = await admin
    .from("upload_invites")
    .select("id, token, name, used_count, expires_at, revoked_at, created_at")
    .eq("token", token)
    .single();

  if (error || !data) {
    throw new InviteError("Invite not found", 404);
  }
  if (data.revoked_at) {
    throw new InviteError("Invite revoked", 403);
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new InviteError("Invite expired", 403);
  }
  return data;
}

function publicInvite(invite: JsonRecord) {
  return {
    name: invite.name,
    used_count: invite.used_count,
    expires_at: invite.expires_at,
  };
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function sanitizeFileName(name: string) {
  return (
    name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(0, 120) || "memory.jpg"
  );
}

function buildDescription(
  description: string,
  source: string,
  inviteName: string,
) {
  const parts = [
    description.trim(),
    source.trim() ? `来源：${source.trim()}` : "",
    inviteName.trim() ? `上传者：${inviteName.trim()}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}
