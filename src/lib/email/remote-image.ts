import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_URL_LENGTH = 12_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const ALLOWED_IMAGE_TYPES = /^image\/(?:avif|gif|jpeg|png|webp|x-icon|vnd\.microsoft\.icon)$/i;

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113);
}

export function isPublicIpAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return !isPrivateIpv4(address);
  if (version !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPublicIpAddress(normalized.slice(7));
  return normalized !== "::" && normalized !== "::1" &&
    !normalized.startsWith("fc") && !normalized.startsWith("fd") &&
    !/^fe[89ab]/.test(normalized) && !normalized.startsWith("ff") &&
    !normalized.startsWith("2001:db8:");
}

export function parseRemoteImageUrl(value: string) {
  if (!value || value.length > MAX_URL_LENGTH) throw new Error("The email image URL is invalid.");
  const url = new URL(value);
  if (url.protocol === "http:") url.protocol = "https:";
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Only standard HTTPS email images are supported.");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("The email image host is not allowed.");
  if (isIP(hostname) && !isPublicIpAddress(hostname)) throw new Error("The email image host is not public.");
  return url;
}

async function validatePublicHost(url: URL) {
  const results = await lookup(url.hostname, { all: true, verbatim: true });
  if (!results.length || results.some((result) => !isPublicIpAddress(result.address))) throw new Error("The email image host is not public.");
}

async function readLimitedBody(response: Response) {
  if (!response.body) throw new Error("The email image response was empty.");
  const declared = Number(response.headers.get("content-length") || "0");
  if (declared > MAX_IMAGE_BYTES) throw new Error("The email image is too large.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error("The email image is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchRemoteEmailImage(value: string) {
  let url = parseRemoteImageUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await validatePublicHost(url);
    const response = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/png,image/jpeg,image/gif,*/*;q=0.5",
        "User-Agent": "Mozilla/5.0 (compatible; TalikhaPublishing/1.0; +https://talikhapublishing.vercel.app)"
      }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) throw new Error("The email image redirected too many times.");
      url = parseRemoteImageUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error("The email image could not be retrieved.");
    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.test(contentType)) throw new Error("The remote resource is not a supported image.");
    return { bytes: await readLimitedBody(response), contentType };
  }
  throw new Error("The email image could not be retrieved.");
}
