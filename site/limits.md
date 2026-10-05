# Limits

No tool can make an agent fully safe. agent-shield reduces risk and limits damage. These are the gaps we know about:

- **Text-only manipulation isn't blocked.** An attack that only changes the answer ("tell the customer to visit scam-site.com") involves no tool, so Check Out can't stop it. Check In marks the content untrusted; a model that obeys anyway will repeat it.
- **Normal-looking actions to allowed places.** Sending private data to an *allowed* address, inside a normal-looking call, passes the rules. After untrusted content it needs approval, so the human is the last check.
- **Taint is kept in memory.** A paused LangGraph run must resume in the same process, and a restart forgets which conversations were tainted.
- **The output check covers images and markdown links,** not plain URLs. Chat apps that preview links can still fetch them.
- **Hex-encoded data in URLs passes** the data-in-URL check (it looks like commit hashes).
- **Phrase rules are English-only.** The classifier covers other languages.
- **The shell deny list can be dodged.** That's why shell tools are `risky` and need approval after untrusted content.
- **The classifier over-flags** some normal content and adds time; see [Results](./results).

Found a bypass? Please report it privately; see [SECURITY.md](https://github.com/priyanshu-34/agent-shield/blob/main/SECURITY.md).
