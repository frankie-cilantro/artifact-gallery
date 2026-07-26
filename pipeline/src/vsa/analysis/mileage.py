"""4.8 Mileage correction: recompute deaths per 10B VMT where HLDI/CARFAX-style
annual-VMT estimates exist. Corrects the luxury/low-mileage confound — expect
luxury and sports cars to worsen, pickups to improve.

VMT input is optional and hand-supplied: data/vmt_by_nameplate.csv with columns
nameplate, annual_vmt_per_vehicle."""
import pandas as pd

from ..config import DATA, OUTPUTS
from .frames import vehicle_rates

VMT_CSV = DATA / "vmt_by_nameplate.csv"


def run() -> pd.DataFrame | None:
    if not VMT_CSV.exists():
        print(f"mileage correction skipped: {VMT_CSV} not present")
        return None
    vmt = pd.read_csv(VMT_CSV)
    df = vehicle_rates().merge(vmt, on="nameplate", how="inner")
    # deaths per MRVY -> deaths per 10B VMT:
    # rate/1e6 deaths per RVY; each RVY drives annual_vmt miles.
    df["rate_per_10b_vmt"] = (df["rate_overall"] / 1e6) / df["annual_vmt_per_vehicle"] * 1e10
    out = df[["nameplate", "class", "study_cycle", "rate_overall",
              "annual_vmt_per_vehicle", "rate_per_10b_vmt"]]
    out.to_csv(OUTPUTS / "mileage_corrected.csv", index=False)
    return out
