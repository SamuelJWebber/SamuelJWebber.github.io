"""Replicate NYC commute estimates using Python 3, pandas and NumPy.

Download the New York person file csv_pny.zip for each year to this directory
as p2019.zip and p2024.zip. Run: python od_commutes.py > od_commutes.json

https://www2.census.gov/programs-surveys/acs/data/pums/2019/1-Year/
https://www2.census.gov/programs-surveys/acs/data/pums/2024/1-Year/

The geographic codes use each year's PUMA vintage. The publicly released
workplace geography covers all Manhattan. ACS workers report their usual
one-way commute and primary mode. Distinct year samples are treated as
independent. The within-year comparison retains joint replicate weights.
"""
import json
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd

# Resident PUMA range, Manhattan workplace PUMA, and Brooklyn community district 2.
GEOGRAPHY = {
    2019: {'brooklyn': (4001, 4018), 'queens': (4101, 4114), 'manhattan': 3800, 'cd2': 4004},
    2024: {'brooklyn': (4301, 4318), 'queens': (4401, 4414), 'manhattan': 4100, 'cd2': 4302},
}
WEIGHTS = ['PWGTP'] + [f'PWGTP{i}' for i in range(1, 81)]
COLUMNS = ['PUMA', 'AGEP', 'POWSP', 'POWPUMA', 'JWTRNS', 'JWMNP'] + WEIGHTS
MODES = {'Car, truck or van': 1, 'Bus': 2, 'Subway or elevated': 3, 'Bicycle': 9}


def interval(estimate, se):
    margin = 1.645 * se
    return {'estimate': float(estimate), 'se': float(se), 'moe90': float(margin),
            'ci90': [float(estimate - margin), float(estimate + margin)]}


def replicate_interval(values):
    standard_error = np.sqrt(4 / 80 * np.sum((values[1:] - values[0]) ** 2))
    return interval(values[0], standard_error)


def summarize(data):
    weights = data[WEIGHTS].to_numpy(dtype=float)
    times = data.JWMNP.to_numpy(dtype=float)
    commuter_totals = weights.sum(axis=0)
    usual_trip_minutes = np.einsum('ij,i->j', weights, times)
    means = usual_trip_minutes / commuter_totals
    result = {'records': len(data), 'commuters': replicate_interval(commuter_totals),
              'minutes': replicate_interval(means),
              'person_minutes_per_one_trip_each': replicate_interval(usual_trip_minutes)}
    return result, means


def one_year(year):
    geo = GEOGRAPHY[year]
    with ZipFile(Path(f'p{year}.zip')) as archive, archive.open('psam_p36.csv') as handle:
        retained = []
        for chunk in pd.read_csv(handle, usecols=COLUMNS, chunksize=20_000):
            origins = chunk.PUMA.between(*geo['brooklyn']) | chunk.PUMA.between(*geo['queens'])
            eligible = origins & (chunk.AGEP >= 16) & (chunk.JWMNP > 0) & (chunk.JWTRNS != 11)
            retained.append(chunk.loc[eligible])
    commuters = pd.concat(retained, ignore_index=True)
    manhattan = commuters[(commuters.POWSP == 36) & (commuters.POWPUMA == geo['manhattan'])]
    brooklyn = manhattan[manhattan.PUMA.between(*geo['brooklyn'])]
    cells = {'Brooklyn, any destination': commuters[commuters.PUMA.between(*geo['brooklyn'])],
             'Brooklyn to Manhattan': brooklyn,
             'Queens to Manhattan': manhattan[manhattan.PUMA.between(*geo['queens'])],
             'Downtown Brooklyn CD2 to Manhattan': brooklyn[brooklyn.PUMA == geo['cd2']]}
    for label, mode in MODES.items():
        cells[f'Brooklyn to Manhattan, {label}'] = brooklyn[brooklyn.JWTRNS == mode]
    outputs, replicate_means = {}, {}
    for label, frame in cells.items():
        outputs[label], replicate_means[label] = summarize(frame)
    gap = replicate_means['Brooklyn to Manhattan'] - replicate_means['Queens to Manhattan']
    outputs['Brooklyn minus Queens, Manhattan workplace'] = {'minutes': replicate_interval(gap)}
    return outputs


if __name__ == '__main__':
    before = one_year(2019)
    after = one_year(2024)
    changes = {}
    for label in before:
        baseline = before[label]['minutes']
        followup = after[label]['minutes']
        delta = followup['estimate'] - baseline['estimate']
        changes[label] = interval(delta, np.hypot(baseline['se'], followup['se']))
    print(json.dumps({'2019': before, '2024': after, 'changes': changes}, indent=2))
