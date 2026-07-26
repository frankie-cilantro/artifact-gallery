"""python -m vsa <stage> — see Makefile for the canonical order."""
import json
import sys


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        print("stages: ingest-iihs-death-rates ingest-iihs-ratings ingest-fars "
              "ingest-crss ingest-vpic resolve load analyze validate report")
        sys.exit(2)
    stage = sys.argv[1]

    if stage == "ingest-iihs-death-rates":
        from .ingest import iihs_death_rates as m
        m.run()
    elif stage == "ingest-iihs-ratings":
        from .ingest import iihs_ratings as m
        m.run()
    elif stage == "ingest-fars":
        from .ingest import fars as m
        m.run()
    elif stage == "ingest-crss":
        from .ingest import crss as m
        m.run()
    elif stage == "ingest-vpic":
        from .ingest import vpic as m
        m.run()
    elif stage == "resolve":
        from .crosswalk import resolve
        df = resolve()
        print(f"resolved {len(df)} IIHS rows — all matched")
    elif stage == "load":
        from .storage import load
        load()
    elif stage == "analyze":
        from .analysis import (descriptive, naive, within_class,
                               variance_decomp, ceiling, survival,
                               persistence, mileage)
        print("4.1 descriptive\n", descriptive.run().head(20))
        print("4.2 naive\n", json.dumps(naive.run(), indent=2, default=float))
        print("4.3 within-class\n", within_class.run().head(20))
        print("4.4 variance decomposition\n", variance_decomp.run())
        print("4.6 ceiling (run before 4.5 — feeds test exclusion)\n",
              ceiling.run().tail(10))
        print("4.5 conditional survival\n", survival.run().head(30))
        print("4.7 persistence\n", persistence.run())
        print("4.8 mileage\n", mileage.run())
    elif stage == "validate":
        from .validate import run
        run()
    elif stage == "report":
        from .report import run
        run()
    else:
        sys.exit(f"unknown stage: {stage}")


if __name__ == "__main__":
    main()
