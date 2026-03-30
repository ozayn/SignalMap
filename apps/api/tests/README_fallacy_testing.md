# Transcript fallacy analysis — manual API checks

Examples assume the API is running locally on **port 8000** (e.g. `uvicorn main:app --reload` from `apps/api`).

## Text analysis

`POST /api/transcript/analyze-text` — paste transcript text; no YouTube fetch.

**Heuristic**

```bash
curl -sS -X POST "http://localhost:8000/api/transcript/analyze-text" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"So you're saying we should just let the country collapse and do nothing.\", \"mode\": \"fallacies\", \"language\": \"en\", \"method\": \"heuristic\"}" | jq .
```

**LLM** (requires `GROQ_API_KEY` on the server)

```bash
curl -sS -X POST "http://localhost:8000/api/transcript/analyze-text" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"So you're saying we should just let the country collapse and do nothing.\", \"mode\": \"fallacies\", \"language\": \"en\", \"method\": \"llm\"}" | jq .
```

## YouTube URL analysis

`POST /api/youtube/transcript/analyze` — fetches captions, chunks, then runs fallacy analysis.

**Heuristic**

```bash
curl -sS -X POST "http://localhost:8000/api/youtube/transcript/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","mode":"fallacies","method":"heuristic"}' | jq .
```

**LLM** (requires `GROQ_API_KEY`)

```bash
curl -sS -X POST "http://localhost:8000/api/youtube/transcript/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","mode":"fallacies","method":"llm"}' | jq .
```

Replace `VIDEO_ID` with a real 11-character id. `jq` is optional; omit `| jq .` to print raw JSON.

For scripted checks against the heuristic ruleset, see `tests/fixtures/fallacy_test_cases.json` and `scripts/run_fallacy_smoke_tests.py`.
