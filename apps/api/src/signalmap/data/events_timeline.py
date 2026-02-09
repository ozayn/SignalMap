"""
Events for the standalone timeline study (1900–present). Categorized for reference use.
Event IDs are reusable for overlays in other studies.
"""

EVENTS_CATEGORIES = [
    "iran_domestic",
    "iran_external",
    "global_geopolitics",
    "energy_markets",
]

EVENTS_IRAN_DOMESTIC: list[dict] = [
    {"id": "ir-1979-revolution", "title": "Iranian Revolution", "category": "iran_domestic", "date_start": "1978-01-01", "date_end": "1979-02-11", "description": "Widespread protests and strikes lead to fall of the monarchy; Islamic Republic established."},
    {"id": "iran-1997-khatami", "title": "Khatami inaugurated", "category": "iran_domestic", "date_start": "1997-08-03", "date_end": None, "description": "Mohammad Khatami became president; reformist policies followed."},
    {"id": "iran-2005-ahmadinejad", "title": "Ahmadinejad inaugurated", "category": "iran_domestic", "date_start": "2005-08-03", "date_end": None, "description": "Mahmoud Ahmadinejad became president."},
    {"id": "iran-2009-election", "title": "Disputed presidential election", "category": "iran_domestic", "date_start": "2009-06-12", "date_end": None, "description": "Election protests and crackdown; Green Movement emerges."},
    {"id": "iran-2013-rouhani", "title": "Rouhani inaugurated", "category": "iran_domestic", "date_start": "2013-08-03", "date_end": None, "description": "Hassan Rouhani became president; nuclear negotiations intensify."},
    {"id": "iran-2015-jcpoa", "title": "JCPOA finalized", "category": "iran_domestic", "date_start": "2015-07-14", "date_end": None, "description": "Joint Comprehensive Plan of Action agreed between Iran and P5+1."},
    {"id": "iran-2018-us-withdrawal", "title": "US withdraws from JCPOA", "category": "iran_domestic", "date_start": "2018-05-08", "date_end": None, "description": "US announces withdrawal from nuclear agreement."},
    {"id": "iran-2021-raisi-elected", "title": "Raisi elected president", "category": "iran_domestic", "date_start": "2021-06-18", "date_end": None, "description": "Ebrahim Raisi wins presidential election amid low turnout."},
    {"id": "iran-2021-raisi-inaugurated", "title": "Raisi sworn in", "category": "iran_domestic", "date_start": "2021-08-03", "date_end": None, "description": "Ebrahim Raisi inaugurated as president."},
    {"id": "iran-2022-amini-protests", "title": "Mahsa Amini protests begin", "category": "iran_domestic", "date_start": "2022-09-16", "date_end": None, "description": "Nationwide protests following death of Mahsa Amini in custody."},
    {"id": "iran-2024-raisi-crash", "title": "Raisi helicopter crash", "category": "iran_domestic", "date_start": "2024-05-19", "date_end": None, "description": "President Raisi and foreign minister killed in helicopter crash."},
    {"id": "president-pezeshkian", "title": "Pezeshkian inaugurated", "category": "iran_domestic", "date_start": "2024-07-28", "date_end": None, "description": "Masoud Pezeshkian became president."},
]

EVENTS_IRAN_EXTERNAL: list[dict] = [
    {"id": "sn-001", "title": "US sanctions after hostage crisis", "category": "iran_external", "date_start": "1979-11-01", "date_end": None, "description": "US froze Iranian assets and imposed sanctions following embassy seizure."},
    {"id": "sn-002", "title": "Iran & Libya Sanctions Act", "category": "iran_external", "date_start": "1996-08-05", "date_end": None, "description": "ILSA imposed secondary sanctions on foreign firms investing in Iran's energy sector."},
    {"id": "sn-003", "title": "UNSC Resolution 1737", "category": "iran_external", "date_start": "2006-12-23", "date_end": None, "description": "UN Security Council imposed sanctions on Iran's nuclear and ballistic missile programs."},
    {"id": "sn-004", "title": "UNSC Resolution 1929", "category": "iran_external", "date_start": "2010-06-09", "date_end": None, "description": "Expanded UN sanctions; arms embargo, asset freezes, financial restrictions."},
    {"id": "sn-005", "title": "JCPOA sanctions relief begins", "category": "iran_external", "date_start": "2015-07-21", "date_end": None, "description": "Implementation day; nuclear-related sanctions lifted under JCPOA."},
    {"id": "sn-005b", "title": "US withdraws from JCPOA", "category": "iran_external", "date_start": "2018-05-08", "date_end": None, "description": "US announces withdrawal; reimposition of nuclear sanctions begins."},
    {"id": "sn-005c", "title": "US reimposes oil and financial sanctions", "category": "iran_external", "date_start": "2018-11-05", "date_end": None, "description": "Second round of US sanctions; targets oil, banking, shipping."},
    {"id": "sn-005d", "title": "Vienna JCPOA talks begin", "category": "iran_external", "date_start": "2021-04-06", "date_end": None, "description": "Negotiations to restore JCPOA resume in Vienna."},
    {"id": "sn-005e", "title": "EU removes JCPOA from agenda", "category": "iran_external", "date_start": "2022-08-08", "date_end": None, "description": "EU coordinator pauses JCPOA restoration talks after final text rejection."},
    {"id": "iran-2024-israel-strike", "title": "Iran–Israel escalation", "category": "iran_external", "date_start": "2024-04-13", "date_end": None, "description": "Iran launches direct strikes on Israel; EU expands sanctions."},
]

EVENTS_GLOBAL_GEOPOLITICS: list[dict] = [
    {"id": "g1900-ww1", "title": "World War I", "category": "global_geopolitics", "date_start": "1914-07-28", "date_end": "1918-11-11", "description": "Global conflict; major powers engaged across Europe and beyond."},
    {"id": "g1900-depression", "title": "Great Depression", "category": "global_geopolitics", "date_start": "1929-10-29", "date_end": "1939-09-01", "description": "Severe global economic downturn following the 1929 stock market crash."},
    {"id": "g1900-ww2", "title": "World War II", "category": "global_geopolitics", "date_start": "1939-09-01", "date_end": "1945-09-02", "description": "Global conflict; European and Pacific theaters."},
    {"id": "g1900-gulf-war", "title": "Gulf War", "category": "global_geopolitics", "date_start": "1990-08-02", "date_end": "1991-02-28", "description": "Iraq invades Kuwait; coalition response."},
    {"id": "g1900-gfc", "title": "Global Financial Crisis", "category": "global_geopolitics", "date_start": "2008-09-15", "date_end": "2009-06-30", "description": "Lehman collapse; global banking crisis."},
    {"id": "g1900-covid", "title": "COVID-19 pandemic", "category": "global_geopolitics", "date_start": "2020-01-30", "date_end": "2022-03-11", "description": "WHO pandemic declaration; global lockdowns."},
    {"id": "g1900-ukraine", "title": "Russia–Ukraine war", "category": "global_geopolitics", "date_start": "2022-02-24", "date_end": None, "description": "Russia's full-scale invasion of Ukraine; energy market disruption."},
    {"id": "iran_israel_12_day_war_2025", "title": "Israel–Iran direct military confrontation", "category": "global_geopolitics", "date_start": "2025-06-13", "date_end": "2025-06-24", "description": "Period of direct military escalation involving missile and drone strikes."},
]

EVENTS_ENERGY_MARKETS: list[dict] = [
    {"id": "g1900-oil-embargo-73", "title": "1973–74 oil embargo", "category": "energy_markets", "date_start": "1973-10-17", "date_end": "1974-03-18", "description": "OPEC oil embargo following the Yom Kippur War; first major oil shock."},
    {"id": "g1900-iran-rev-oil", "title": "Iranian Revolution oil shock", "category": "energy_markets", "date_start": "1979-01-01", "date_end": "1981-01-20", "description": "Oil supply disruption following Iranian Revolution."},
    {"id": "wl-002", "title": "WTI crude briefly negative", "category": "energy_markets", "date_start": "2020-04-20", "date_end": None, "description": "WTI crude oil futures briefly trade negative amid storage glut."},
    {"id": "wl-003", "title": "OPEC+ agree to gradually increase production", "category": "energy_markets", "date_start": "2021-07-18", "date_end": None, "description": "OPEC+ agrees to raise output by 400k bpd monthly from August."},
    {"id": "wl-005", "title": "OPEC+ major production cut", "category": "energy_markets", "date_start": "2022-10-05", "date_end": None, "description": "OPEC+ announces 2 million bpd production cut."},
    {"id": "wl-006", "title": "EU Russian oil embargo begins", "category": "energy_markets", "date_start": "2022-12-05", "date_end": None, "description": "EU ban on seaborne Russian crude oil imports takes effect."},
    {"id": "wl-007", "title": "OPEC+ surprise production cut", "category": "energy_markets", "date_start": "2023-04-02", "date_end": None, "description": "OPEC+ announces surprise production cut of 1.16 million bpd."},
    {"id": "wl-008", "title": "Hamas attack on Israel", "category": "energy_markets", "date_start": "2023-10-07", "date_end": None, "description": "Hamas attacks Israel; regional tensions escalate."},
    {"id": "wl-009", "title": "OPEC+ extends production cuts", "category": "energy_markets", "date_start": "2024-06-02", "date_end": None, "description": "OPEC+ extends deep production cuts into 2025."},
]

EVENTS_TIMELINE_ALL: list[dict] = (
    EVENTS_IRAN_DOMESTIC
    + EVENTS_IRAN_EXTERNAL
    + EVENTS_GLOBAL_GEOPOLITICS
    + EVENTS_ENERGY_MARKETS
)
