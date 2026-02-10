"""Iran nominal minimum wage and CPI for real wage study.

- Nominal minimum wage: monthly gross minimum wage (million rials per month).
  Sourced from ILO ILOSTAT / national statistical releases. Annual value = typical
  value for that year (implementation may use start-of-year or average).
- CPI: Iran Consumer Price Index (2010 = 100). World Bank FP.CPI.TOTL (Iran).
  https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=IR

Educational use; not for policy or causal inference. Values may be revised in source data.
"""

# Year -> nominal monthly minimum wage (million rials). Approximate from ILO/national sources.
# One value per year; date format in API is YYYY-01-01.
IRAN_NOMINAL_MINIMUM_WAGE: dict[int, float] = {
    2010: 3.03,
    2011: 3.63,
    2012: 4.87,
    2013: 6.49,
    2014: 8.12,
    2015: 8.12,
    2016: 9.29,
    2017: 11.07,
    2018: 14.04,
    2019: 18.56,
    2020: 26.35,
    2021: 49.55,
    2022: 56.50,
    2023: 80.30,
    2024: 112.00,
}

# Year -> CPI (2010 = 100). World Bank FP.CPI.TOTL, Iran. Approximate.
IRAN_CPI_2010_BASE: dict[int, float] = {
    2010: 100.0,
    2011: 121.5,
    2012: 155.2,
    2013: 204.2,
    2014: 258.1,
    2015: 294.6,
    2016: 348.2,
    2017: 412.5,
    2018: 523.4,
    2019: 702.1,
    2020: 923.8,
    2021: 1205.0,
    2022: 1580.0,
    2023: 2050.0,
    2024: 2580.0,
}

WAGE_CPI_BASE_YEAR = 2010
