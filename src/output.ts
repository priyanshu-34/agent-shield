import { domainAllowed, findSecrets, findUrlData, redactSecrets } from "./check-out.js";

export interface OutputResult {
  text: string;
  removed: string[];
}

// Images load by themselves when the chat shows the answer, so any image to an unknown site can leak data.
export function checkOutput(text: string, allowImageDomains: string[], hideSecrets = true): OutputResult {
  const removed: string[] = [];
  const imageOk = (url: string) => {
    const u = url.trim().replace(/^<|>$/g, "");
    if (!/^https?:\/\//i.test(u) && !u.startsWith("//")) return true;
    return domainAllowed(u.startsWith("//") ? `https:${u}` : u, allowImageDomains);
  };
  const linkOk = (url: string) => !findUrlData(url).length && !findSecrets(url).length;

  // reference-style definitions: [id]: https://...
  const refs = new Map<string, string>();
  text.replace(/^[ \t]*\[([^\]]+)\]:[ \t]*(\S+).*$/gm, (_, id: string, url: string) => (refs.set(id.toLowerCase(), url), ""));
  const badRefs = new Set([...refs].filter(([, url]) => !imageOk(url) || !linkOk(url)).map(([id]) => id));

  let out = text
    .replace(/!\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)[^)]*\)/g, (m, alt: string, url: string) =>
      imageOk(url) ? m : (removed.push(`image to ${host(url)}`), `[image removed${alt ? `: ${alt}` : ""}]`))
    .replace(/!\[([^\]]*)\](?!\()(?:\[([^\]]*)\])?/g, (m, alt: string, id?: string) => {
      const key = (id || alt).toLowerCase();
      return badRefs.has(key) ? (removed.push(`image to ${host(refs.get(key)!)}`), `[image removed${alt ? `: ${alt}` : ""}]`) : m;
    })
    .replace(/<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)[^>]*>/gi, (m, url: string) =>
      imageOk(url) ? m : (removed.push(`image to ${host(url)}`), "[image removed]"))
    .replace(/(?<!!)\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)[^)]*\)/g, (m, label: string, url: string) =>
      linkOk(url) ? m : (removed.push(`link to ${host(url)} carrying data`), label))
    .replace(/^[ \t]*\[([^\]]+)\]:[ \t]*\S+.*$/gm, (m, id: string) => (badRefs.has(id.toLowerCase()) ? "" : m));

  if (hideSecrets) {
    const hidden = redactSecrets(out);
    if (hidden !== out) removed.push("secrets");
    out = hidden;
  }
  return { text: out, removed };
}

function host(url: string): string {
  try {
    return new URL(url.replace(/^<|>$/g, "").replace(/^\/\//, "https://")).hostname;
  } catch {
    return "unknown site";
  }
}
