// Aggregates from the reproducible scripts and underlying matched cells under methods/.
export const eastRiver = {
  "Brooklyn": {
    "leave_one_station_pair_out_change_range": [
      -2.420505453996486,
      -1.6076803590865552
    ],
    "weighted_within_cell_median_change": -1.7294271174863387,
    "eligible_before_after": [
      570,
      903
    ],
    "matched_before_after": [
      122,
      151
    ],
    "matched_ordered_station_pairs": 13,
    "matched_pair_time_cells": 23,
    "mean_minutes": [
      16.79726393442623,
      14.608471270595295
    ],
    "change": -2.1887926638309345,
    "unadjusted_group_medians": [
      15.883541666666666,
      15.324416666666668
    ]
  },
  "Manhattan": {
    "leave_one_station_pair_out_change_range": [
      -1.4001846172839512,
      0.4682941267513846
    ],
    "weighted_within_cell_median_change": 0.8268977477477469,
    "eligible_before_after": [
      401,
      487
    ],
    "matched_before_after": [
      74,
      76
    ],
    "matched_ordered_station_pairs": 9,
    "matched_pair_time_cells": 14,
    "mean_minutes": [
      14.077050675675679,
      13.972957286377286
    ],
    "change": -0.10409338929839329,
    "unadjusted_group_medians": [
      14.051666666666668,
      14.761483333333333
    ]
  },
  "relative": -2.0846992745325412,
  "intervals": {
    "Brooklyn": {
      "change": -2.1887926638309327,
      "cluster_se": 0.8340948853430477,
      "conditional_95_interval": [
        -3.9345732771311797,
        -0.4430120505306856
      ]
    },
    "Manhattan": {
      "change": -0.10409338929838796,
      "cluster_se": 0.8863227968385027,
      "conditional_95_interval": [
        -1.9591882748284983,
        1.7510014962317224
      ]
    },
    "Brooklyn_minus_Manhattan": {
      "change": -2.0846992745325448,
      "cluster_se": 1.1278546069287683,
      "conditional_95_interval": [
        -4.4453260353450235,
        0.2759274862799339
      ]
    }
  },
  "checks": [
    [
      "Primary settings",
      -2.1887926638309345,
      -0.10409338929839329,
      -2.0846992745325412
    ],
    [
      "Docks within 500 m",
      -1.6992027200066726,
      0.4451432631398742,
      -2.144345983146547
    ],
    [
      "Docks within 1,000 m",
      -1.921602163204005,
      -0.10409338929839329,
      -1.8175087739056117
    ],
    [
      "Maximum trip 60 min",
      -2.1541684526045586,
      -0.10409338929839329,
      -2.0500750633061653
    ],
    [
      "Maximum trip 120 min",
      -2.8851215581629344,
      -0.10409338929839329,
      -2.781028168864541
    ],
    [
      "At least 1 trip per cell and year",
      -0.9811952190944453,
      0.6526579825080052,
      -1.6338532016024505
    ],
    [
      "At least 5 trips per cell and year",
      -1.9672105050505078,
      1.602387299242423,
      -3.569597804292931
    ]
  ]
};
export const pulaski = {
  "cells": 35,
  "trips0": 930,
  "trips1": 2015,
  "directed_pairs": 15,
  "fixed_avg_median_sec0": 398.71505376344084,
  "fixed_avg_median_sec1": 398.1290322580645,
  "delta_secs": -0.5860215053763227,
  "fixed_avg_untrimmed_sec0": 515.9548387096775,
  "fixed_avg_untrimmed_sec1": 452.07629335591463,
  "fixed_avg_45mincap_sec0": 440.10537634408604,
  "fixed_avg_45mincap_sec1": 420.98460157994873,
  "delta_cappedmean_secs": -19.12077476413731,
  "max0": 59073,
  "max1": 34073,
  "over45m0": 3,
  "over45m1": 3,
  "over90m0": 2,
  "over90m1": 3,
  "faster_cells": 22
};
export const pathCounts = {"Brooklyn": [45715, 82378], "Manhattan": [121056, 116917]};
