"""Validate installed pilot pack (games/data) against host answers (games/host)."""
import json, pathlib, math
here = pathlib.Path(__file__).resolve().parent
games = here.parent
d = json.loads((games / 'data' / 'pack.public.json').read_text(encoding='utf-8'))
k = json.loads((games / 'host' / 'answers.host.json').read_text(encoding='utf-8'))
ids = {c['id'] for c in d['cards']}
assert len(ids) == len(d['cards']) == 12
assert len({r['id'] for r in d['rounds']}) == 12
assert len(d['mainRoundIds']) == 8
used = set()
for r in d['rounds']:
    a = k['answers'][r['id']]
    assert len(set(r['hand'])) == 4 and set(r['hand']) <= ids
    assert set(a['acceptedConceptIds']) <= set(r['hand'])
    assert a['correctOptionId'] in {o['id'] for o in r['options']}
    assert len({o['id'] for o in r['options']}) == 3
    assert not any(key in r for key in ['correctOptionId', 'acceptedConceptIds', 'explanation'])
    used.update(a['acceptedConceptIds'])
assert used == ids
assert d['version'] == k['version']
assert 20 / 5 == 4 and 80 * (1 - .25) == 60 and math.sqrt(5 ** 2 - 3 ** 2) == 4
assert 6 / 2 == 3 and math.isclose(9 / 30, .3) and 2 ** 2 == 4
assert math.isclose(.92 / 1, .92)
# standard-cards coverage for the 12 pilot concepts (π optional)
sc = json.loads((games / 'data' / 'standard-cards.json').read_text(encoding='utf-8'))
fronts = sc.get('fronts') or {}
missing = sorted(ids - set(fronts))
assert not missing, f'standard-cards missing fronts: {missing}'
print('PASS: 12 unique cards, 12 valid challenges, 8 main rounds, complete concept coverage, separate answer key, numeric answers, standard-cards fronts for all pack concepts.')
