// NYMTC Tables 26 and 27; NYC DOT walking counts are combined across directions.
export const sector = [
  {
    "year": 2016,
    "period": "am",
    "hours": 2,
    "inExclWalk": 287258,
    "outExclWalk": 75521,
    "walkBoth": 1263,
    "allBoth": 364042
  },
  {
    "year": 2016,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 147350,
    "outExclWalk": 337736,
    "walkBoth": 4443,
    "allBoth": 489529
  },
  {
    "year": 2017,
    "period": "am",
    "hours": 2,
    "inExclWalk": 289759,
    "outExclWalk": 75146,
    "walkBoth": 1348,
    "allBoth": 366253
  },
  {
    "year": 2017,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 148273,
    "outExclWalk": 349401,
    "walkBoth": 5079,
    "allBoth": 502753
  },
  {
    "year": 2018,
    "period": "am",
    "hours": 2,
    "inExclWalk": 286184,
    "outExclWalk": 76408,
    "walkBoth": 1062,
    "allBoth": 363654
  },
  {
    "year": 2018,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 149519,
    "outExclWalk": 351476,
    "walkBoth": 5410,
    "allBoth": 506405
  },
  {
    "year": 2021,
    "period": "am",
    "hours": 2,
    "inExclWalk": 153923,
    "outExclWalk": 61034,
    "walkBoth": 1180,
    "allBoth": 216137
  },
  {
    "year": 2021,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 104432,
    "outExclWalk": 202260,
    "walkBoth": 3430,
    "allBoth": 310122
  },
  {
    "year": 2022,
    "period": "am",
    "hours": 2,
    "inExclWalk": 187651,
    "outExclWalk": 59367,
    "walkBoth": 1052,
    "allBoth": 248070
  },
  {
    "year": 2022,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 111650,
    "outExclWalk": 247278,
    "walkBoth": 3573,
    "allBoth": 362501
  },
  {
    "year": 2023,
    "period": "am",
    "hours": 2,
    "inExclWalk": 177174,
    "outExclWalk": 57527,
    "walkBoth": 1186,
    "allBoth": 235887
  },
  {
    "year": 2023,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 115387,
    "outExclWalk": 247418,
    "walkBoth": 3865,
    "allBoth": 366670
  },
  {
    "year": 2024,
    "period": "am",
    "hours": 2,
    "inExclWalk": 212255,
    "outExclWalk": 64513,
    "walkBoth": 1822,
    "allBoth": 278590
  },
  {
    "year": 2024,
    "period": "pm",
    "hours": 3,
    "inExclWalk": 128557,
    "outExclWalk": 284279,
    "walkBoth": 6631,
    "allBoth": 419467
  }
];
export const sectorSources = {
  "2016": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/DM_TDS_Hub_Bound_Travel_2016-FINAL.pdf#page=62",
    "out": "https://www.nymtc.org/sites/default/files/rfp/DM_TDS_Hub_Bound_Travel_2016-FINAL.pdf#page=63",
    "physicalPdfPages": [
      62,
      63
    ]
  },
  "2017": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/2017_Hub-Bound-August_15_2019.pdf#page=75",
    "out": "https://www.nymtc.org/sites/default/files/rfp/2017_Hub-Bound-August_15_2019.pdf#page=76",
    "physicalPdfPages": [
      75,
      76
    ]
  },
  "2018": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/DM_TDS_Hub_Bound_Travel_2018.pdf#page=75",
    "out": "https://www.nymtc.org/sites/default/files/rfp/DM_TDS_Hub_Bound_Travel_2018.pdf#page=76",
    "physicalPdfPages": [
      75,
      76
    ]
  },
  "2021": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/DM_TDS_Hub_Bound_Travel_2021_03-10-2023.pdf#page=75",
    "out": "https://www.nymtc.org/sites/default/files/rfp/DM_TDS_Hub_Bound_Travel_2021_03-10-2023.pdf#page=76",
    "physicalPdfPages": [
      75,
      76
    ]
  },
  "2022": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/2022%20Hub%20Bound%20Report-%205.17.24-FINAL%20corrected.pdf#page=75",
    "out": "https://www.nymtc.org/sites/default/files/rfp/2022%20Hub%20Bound%20Report-%205.17.24-FINAL%20corrected.pdf#page=76",
    "physicalPdfPages": [
      75,
      76
    ]
  },
  "2023": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/2023%20Hub%20Bound%20Report-%203.18.25.pdf#page=75",
    "out": "https://www.nymtc.org/sites/default/files/rfp/2023%20Hub%20Bound%20Report-%203.18.25.pdf#page=76",
    "physicalPdfPages": [
      75,
      76
    ]
  },
  "2024": {
    "in": "https://www.nymtc.org/sites/default/files/rfp/2024%20Hub%20Bound%20Report%20%282%29.pdf#page=75",
    "out": "https://www.nymtc.org/sites/default/files/rfp/2024%20Hub%20Bound%20Report%20%282%29.pdf#page=76",
    "physicalPdfPages": [
      75,
      76
    ]
  }
};
