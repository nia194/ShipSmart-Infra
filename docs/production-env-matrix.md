# Production Environment Variable Matrix

> **This document has been superseded by `docs/production-env-reference.md`**
> which includes the full Python API configuration and removes stale Supabase
> variables from the Python service.

See [production-env-reference.md](production-env-reference.md) for the current reference.

## Quick Reference

### Secrets to set in Render dashboard

| Service | Variable | Source |
|---------|----------|--------|
| web | `VITE_SUPABASE_URL` | Supabase dashboard > Settings > API |
| web | `VITE_SUPABASE_ANON_KEY` | Supabase dashboard > Settings > API |
| api-java | `DATABASE_URL` | Supabase > Settings > Database |
| api-java | `DATABASE_USERNAME` | Supabase > Settings > Database |
| api-java | `DATABASE_PASSWORD` | Supabase > Settings > Database |
| api-java | `SUPABASE_URL` | Supabase dashboard > Settings > API |
| api-java | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard > Settings > API |
| api-java | `SUPABASE_JWT_SECRET` | Supabase dashboard > Settings > API > JWT Settings |
| api-python | `OPENAI_API_KEY` | OpenAI dashboard (optional) |

### DATABASE_URL Format

Supabase provides:
```
postgresql://postgres.xxx:password@host:5432/postgres
```

Spring Boot requires the `jdbc:` prefix:
```
jdbc:postgresql://host:5432/postgres?user=postgres.xxx&password=xxx&sslmode=require
```

Alternatively, use separate `DATABASE_URL` + `DATABASE_USERNAME` + `DATABASE_PASSWORD`.
