"""Estimated annual Iran crude oil exports (million barrels per year).

Source: EIA Country Analysis Brief, tanker tracking estimates (Vortexa).
Values are estimates; export volumes under sanctions are uncertain.
Years 2010–2024 where estimates exist."""

# year -> million barrels. Estimated crude oil and condensate exports.
IRAN_EXPORT_VOLUME_EST: dict[int, float] = {
    2010: 730,
    2011: 730,
    2012: 550,
    2013: 450,
    2014: 450,
    2015: 550,
    2016: 700,
    2017: 730,
    2018: 550,
    2019: 200,
    2020: 146,
    2021: 300,
    2022: 450,
    2023: 511,
    2024: 500,
}
