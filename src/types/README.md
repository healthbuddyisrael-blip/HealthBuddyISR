# Database types

Generate `database.ts` from an applied database schema rather than maintaining duplicate handwritten table types:

```bash
npx supabase gen types typescript --local --schema public > src/types/database.ts
```

For a linked hosted project:

```bash
npx supabase gen types typescript --linked --schema public > src/types/database.ts
```

Only redirect output after the CLI and database are available; a failed command can create an empty file. Commit the generated file, then parameterize both Supabase clients with its `Database` type. `domain.ts` remains a small application role type until genuine generated types are available. No generated types have been fabricated.
