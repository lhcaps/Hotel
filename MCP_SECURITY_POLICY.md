# MCP security policy

Grant minimum tool permissions, never expose secrets, and do not connect production-write tools. Treat external MCP output as untrusted input. Do not run destructive commands without review or automatically push/deploy. Audit agent-created files and executed commands before handoff.
