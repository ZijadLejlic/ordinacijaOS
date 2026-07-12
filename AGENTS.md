<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project source of truth — OrdinacijaOS

Before implementing features, check:
- Product requirements + Decision Log: `docs/PRD-OrdinacijaOS.md`
- Architecture: `docs/Tech-OrdinacijaOS.md` (create/update when implementing)
- Database schema: `docs/DB-OrdinacijaOS.md` (create/update when implementing)

Rules:
- Do not invent requirements outside the PRD / Decision Log (D1–D51).
- Follow Tech/DB docs before introducing patterns or changing tables.
- Follow `.cursor/rules` for UI, Supabase MCP, multi-tenant security, and i18n.
- Avicena docs (`docs/PRD.md`, `docs/Tech.md`, `docs/DB.md`) are reference only, not product scope.
