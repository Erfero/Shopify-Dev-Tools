"""
Shopify Files API uploader — staged upload flow (GraphQL Admin API 2024-01).

Flow:
  1. Download image from URL
  2. stagedUploadsCreate → get S3 upload URL + parameters
  3. POST to S3 with the image binary
  4. fileCreate → register file in Shopify Files section
"""
import logging
import mimetypes
import re

import httpx

logger = logging.getLogger(__name__)

_API_VERSION = "2024-01"

_STAGE_MUTATION = """
mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
  stagedUploadsCreate(input: $input) {
    stagedTargets {
      url
      resourceUrl
      parameters { name value }
    }
    userErrors { field message }
  }
}
"""

_CREATE_MUTATION = """
mutation fileCreate($files: [FileCreateInput!]!) {
  fileCreate(files: $files) {
    files {
      id
      alt
      createdAt
      ... on MediaImage {
        image { url width height }
      }
      ... on GenericFile { url }
    }
    userErrors { field message }
  }
}
"""


def _graphql_url(store_domain: str) -> str:
    domain = store_domain.strip().lower()
    if not domain.endswith(".myshopify.com"):
        domain = f"{domain}.myshopify.com"
    return f"https://{domain}/admin/api/{_API_VERSION}/graphql.json"


async def upload_image_to_shopify(
    image_url: str,
    store_domain: str,
    api_token: str,
    filename: str = "product-lifestyle.jpg",
    alt_text: str = "",
) -> dict:
    """Download image_url → upload to Shopify Files. Returns {success, url, id}."""
    graphql = _graphql_url(store_domain)
    headers = {
        "X-Shopify-Access-Token": api_token.strip(),
        "Content-Type": "application/json",
    }

    # ── 1. Download image ────────────────────────────────────────────────────
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        image_bytes = img_resp.content
        ct = img_resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()

    # Ensure filename has an extension
    ext = mimetypes.guess_extension(ct) or ".jpg"
    ext = ext.replace(".jpe", ".jpg")
    if not re.search(r"\.\w{2,5}$", filename):
        filename = filename + ext

    # ── 2. Staged upload ─────────────────────────────────────────────────────
    async with httpx.AsyncClient(timeout=30) as client:
        stage_resp = await client.post(
            graphql,
            headers=headers,
            json={
                "query": _STAGE_MUTATION,
                "variables": {
                    "input": [{
                        "filename": filename,
                        "mimeType": ct,
                        "resource": "FILE",
                        "fileSize": str(len(image_bytes)),
                        "httpMethod": "POST",
                    }]
                },
            },
        )
        stage_resp.raise_for_status()
        stage_data = stage_resp.json()

    errors = stage_data.get("data", {}).get("stagedUploadsCreate", {}).get("userErrors", [])
    if errors:
        raise Exception(f"Shopify staged upload: {errors}")

    targets = stage_data["data"]["stagedUploadsCreate"]["stagedTargets"]
    if not targets:
        raise Exception("No staged upload target returned by Shopify")

    target = targets[0]
    upload_url: str = target["url"]
    resource_url: str = target["resourceUrl"]
    params: list[dict] = target["parameters"]

    # ── 3. Upload to S3 ──────────────────────────────────────────────────────
    form_fields = {p["name"]: (None, p["value"]) for p in params}
    form_fields["file"] = (filename, image_bytes, ct)

    async with httpx.AsyncClient(timeout=60) as client:
        s3_resp = await client.post(upload_url, files=form_fields)
        s3_resp.raise_for_status()

    # ── 4. Create Shopify File ───────────────────────────────────────────────
    async with httpx.AsyncClient(timeout=30) as client:
        create_resp = await client.post(
            graphql,
            headers=headers,
            json={
                "query": _CREATE_MUTATION,
                "variables": {
                    "files": [{
                        "originalSource": resource_url,
                        "alt": alt_text or filename,
                        "contentType": "IMAGE",
                    }]
                },
            },
        )
        create_resp.raise_for_status()
        create_data = create_resp.json()

    # Top-level GraphQL errors (auth, rate-limit, etc.)
    top_errors = create_data.get("errors")
    if top_errors and not create_data.get("data"):
        raise Exception(f"Shopify GraphQL: {top_errors}")

    file_create = (create_data.get("data") or {}).get("fileCreate") or {}
    create_errors = file_create.get("userErrors", [])
    if create_errors:
        msgs = [e.get("message", "") for e in create_errors]
        logger.warning("fileCreate userErrors for %s: %s", filename, msgs)
        # Duplicate file → already in Shopify, count as success
        if any("duplicate" in m.lower() or "already" in m.lower() for m in msgs):
            return {"success": True, "id": "", "url": resource_url, "filename": filename, "note": "already_exists"}
        raise Exception("; ".join(msgs))

    files = file_create.get("files", [])
    if files:
        f = files[0]
        shopify_url = (
            (f.get("image") or {}).get("url")
            or f.get("url")
            or resource_url
        )
        return {"success": True, "id": f.get("id", ""), "url": shopify_url, "filename": filename}

    return {"success": True, "id": "", "url": resource_url, "filename": filename}
