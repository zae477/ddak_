import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { transformSync } from 'esbuild';

const context = createContext({ window: {}, React: {} });
const readSource = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
runInContext(readSource('subwayGraph_browser.js'), context);
const graph = context.SubwayGraph = context.window.SubwayGraph;
runInContext(transformSync(readSource('result.jsx'), { loader: 'jsx' }).code, context);

const spots = names => names.map(value => ({ value }));
const recommend = (names, shared) => context.calculateResults(spots(names), shared).results;

test('adds verified lines and intermediate stations with the correct neighboring stops', () => {
  for (const [from, to, line, minutes] of [
    ['김포공항', '원종', '서해', 5],
    ['원종', '부천종합운동장', '서해', 3],
    ['일산', '풍산', '서해', 2],
    ['시우', '원시', '서해', 3],
    ['진접', '오남', '4', 2],
    ['하남시청', '하남검단산', '5', 3],
    ['사가정', '용마산', '7', 2],
    ['사가정', '면목', '7', 2],
    ['상봉', '면목', '7', 1],
    ['상봉', '중화', '7', 2],
    ['복정', '남위례', '8', 2],
    ['남위례', '산성', '8', 2],
  ]) {
    assert.ok(graph.SUBWAY_GRAPH[from].some(edge => edge.to === to && edge.line === line && edge.time === minutes));
    assert.ok(graph.linesAt(to).includes(line));
  }
  assert.equal(graph.matchStation('당고개역'), '불암산');
  assert.equal(graph.matchStation('뚝섬유원지역'), '자양');
});

test('recommends the midpoint of a short trip and keeps a same-station search at that station', () => {
  const [midpoint] = recommend(['강남', '선릉']);
  assert.equal(midpoint.name, '역삼');
  assert.deepEqual(Array.from(midpoint.times, time => time.mins), [2, 3]);

  const sameStation = recommend(['잠실', '잠실', '잠실']);
  assert.equal(sameStation.length, 1);
  assert.equal(sameStation[0].name, '잠실');
  assert.equal(sameStation[0].times[0].mins, 0);
});

test('the first recommendation has no alternative that improves time or transfers without making anyone worse off', () => {
  for (const names of [
    ['상일동', '고색'], ['서울역', '왕십리'], ['노원', '목동', '잠실'], ['한강진', '서울숲', '신당'],
  ]) {
    const [first] = recommend(names);
    for (const alternative of graph.findMiddleStations(spots(names))) {
      const noWorse = alternative.times.every((time, i) =>
        time.mins <= first.times[i].mins && time.transfers <= first.times[i].transfers);
      const strictlyBetter = alternative.times.some((time, i) =>
        time.mins < first.times[i].mins || time.transfers < first.times[i].transfers);
      assert.ok(!(noWorse && strictlyBetter), `${alternative.name} should rank above ${first.name}`);
    }
  }
});

test('keeps an earlier shared meeting station even when a new route changes eligible recommendations', () => {
  const names = ['김포공항', '부천종합운동장'];
  assert.equal(recommend(names)[0].name, '원종');
  assert.ok(!recommend(names).some(station => station.name === '작전'));

  const reopened = recommend(names, '작전');
  assert.equal(reopened[0].name, '원종');
  assert.equal(reopened.find(station => station.name === '작전').rank, null);
  assert.ok(reopened.length <= 10);
});
