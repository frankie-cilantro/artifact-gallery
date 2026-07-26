PY := python -m vsa

.PHONY: ingest resolve load analyze validate report all test

ingest:
	$(PY) ingest-iihs-death-rates
	$(PY) ingest-iihs-ratings
	$(PY) ingest-fars
	$(PY) ingest-crss
	$(PY) ingest-vpic

resolve:
	$(PY) resolve

load:
	$(PY) load

analyze:
	$(PY) analyze

validate:
	$(PY) validate

report:
	$(PY) report

test:
	pytest tests/ -q

all: ingest resolve load analyze validate report
