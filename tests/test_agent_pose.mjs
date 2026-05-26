import test from 'node:test';
import assert from 'node:assert/strict';

import { getAgentPose, selectInteractionAnchor, selectInteractionTarget } from '../public/agent_pose.mjs';

const decor = [
  { type: 'table' },
  { type: 'terminal' },
  { type: 'bookshelf' },
  { type: 'sofa' },
];
const positions = [
  { x: 10, y: 10 },
  { x: 20, y: 20 },
  { x: 30, y: 30 },
  { x: 40, y: 40 },
];

test('getAgentPose maps planning and working toolsets to readable poses', () => {
  assert.equal(getAgentPose({ state: 'planning', task: 'search_files' }).pose, 'planning');
  assert.equal(getAgentPose({ state: 'working', task: 'terminal' }).pose, 'terminal');
  assert.equal(getAgentPose({ state: 'idle', task: null }).pose, 'rest');
});

test('selectInteractionAnchor prefers matching room props before fallback', () => {
  const planning = selectInteractionAnchor({ state: 'planning', task: 'read_file' }, decor, positions, { x: 99, y: 99 });
  const working = selectInteractionAnchor({ state: 'working', task: 'terminal' }, decor, positions, { x: 99, y: 99 });
  const idle = selectInteractionAnchor({ state: 'idle', task: null }, decor, positions, { x: 99, y: 99 });

  assert.deepEqual(planning, { x: 10, y: 10 });
  assert.deepEqual(working, { x: 20, y: 20 });
  assert.deepEqual(idle, { x: 40, y: 40 });
});

test('planning and dispatch poses prefer whiteboards and portals when present', () => {
  const roomDecor = [
    { type: 'desk' },
    { type: 'board' },
    { type: 'portal' },
    { type: 'terminal' },
  ];
  const roomPositions = [
    { x: 15, y: 15 },
    { x: 25, y: 25 },
    { x: 35, y: 35 },
    { x: 45, y: 45 },
  ];

  const planning = selectInteractionAnchor({ state: 'planning', task: 'search_files' }, roomDecor, roomPositions, { x: 99, y: 99 });
  const dispatch = selectInteractionAnchor({ state: 'working', task: 'delegate_task' }, roomDecor, roomPositions, { x: 99, y: 99 });

  assert.deepEqual(planning, { x: 25, y: 25 });
  assert.deepEqual(dispatch, { x: 35, y: 35 });
});

test('interaction targets include object and action metadata for arrival poses', () => {
  const roomDecor = [
    { type: 'bed', label: 'Rest Bed' },
    { type: 'cabinet', label: 'Archive Cabinet' },
  ];
  const roomPositions = [
    { x: 12, y: 70 },
    { x: 84, y: 22 },
  ];

  const rest = selectInteractionTarget({ state: 'idle', task: null }, roomDecor, roomPositions, { x: 99, y: 99 });
  const archive = selectInteractionTarget({ state: 'working', task: 'archive history' }, roomDecor, roomPositions, { x: 99, y: 99 });

  assert.equal(rest.propType, 'bed');
  assert.equal(rest.objectIcon, '🛏️');
  assert.equal(rest.actionLabelZh, '休息');
  assert.equal(archive.propType, 'cabinet');
  assert.equal(archive.actionLabelZh, '查閱資料');
});
