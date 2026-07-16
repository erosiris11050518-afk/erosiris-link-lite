/* ============================================================
   store.js — 数据模型、模板、localStorage 持久化
   ============================================================ */

var SP = window.SP = window.SP || {};

/* ---------- 内置设备类型 ---------- */

SP.DEVICE_TYPES = {
  mixer:   { name: '调音台', abbr: 'MIX' },
  switch:  { name: '交换机', abbr: 'SW' },
  dsp:     { name: 'DSP',    abbr: 'DSP' },
  amp:     { name: '功放',   abbr: 'AMP' },
  speaker: { name: '音箱',   abbr: 'SPK' }
};

SP.TYPE_ORDER = ['mixer', 'switch', 'dsp', 'amp', 'speaker'];

/* 各类型默认颜色（可被每台设备单独覆盖） */
SP.TYPE_COLORS = {
  mixer: '#eda63d', switch: '#3fbfb0', dsp: '#6ba3c4', amp: '#a08fc0', speaker: '#4fbf8b'
};

/* 网口线（Dante 数字层）在框图中的专属颜色 */
SP.NET_COLOR = '#3fbfb0';
SP.typeColor = function (type) { return SP.TYPE_COLORS[type] || '#7f8b99'; };

/* ---------- 线材类型 ---------- */

SP.CABLE_TYPES = ['卡农信号线', '6.5信号线', '音箱线', 'RCA莲花线', '网线(Dante)', '其他'];

/* ---------- 端口接口类型（接线教学标注用） ---------- */

SP.CONN_TYPES = ['XLR', 'TRS', 'Line', 'RCA', 'SpeakON'];

/* 默认接口：音箱=音响线接口 SpeakON（有源音箱输入除外），功放输出=SpeakON，其余=卡农 XLR */
SP.defaultConn = function (dev, side) {
  if (!dev) return 'XLR';
  var active = dev.specs && dev.specs.powered === 'active';
  if (dev.type === 'speaker') {
    if (side === 'in' && active) return 'XLR';
    return 'SpeakON';
  }
  if (dev.type === 'amp' && side === 'out') return 'SpeakON';
  return 'XLR';
};

/* ---------- 外围输入设备类别（话筒/乐器等，仅清单管理） ---------- */

SP.GEAR_CATS = ['话筒', '乐器', 'DI盒', '播放设备', '无线系统', '其他'];

/* ---------- 乐手工作流：模板、阵容、调音台需求反推 ---------- */

SP.PERFORMER_ROLES = [
  { key: 'vocalist', name: '主唱' },
  { key: 'guitarist', name: '吉他手' },
  { key: 'bassist', name: '贝斯手' },
  { key: 'keyboardist', name: '键盘手' },
  { key: 'drummer', name: '鼓手' },
  { key: 'dj', name: 'DJ / 播放' },
  { key: 'wind', name: '管乐手' },
  { key: 'strings', name: '弦乐手' },
  { key: 'engineer', name: '调音师' },
  { key: 'other', name: '其他' }
];

SP.PERFORMER_CONNECTORS = ['XLR', 'TRS', 'TS', 'RCA', 'USB', 'Dante', '其他'];
SP.MONITOR_TYPES = ['无', 'IEM', '舞台返送', '耳机', '侧填', '其他'];
SP.ROUTE_TYPES = ['direct', 'bus', 'matrix'];

/* ---------- 常见型号模板（路数为常用配置，可在自定义中调整） ---------- */

SP.SPEAKER_ROLES = [
  { key: 'linearray', name: '线阵列', order: 0 },
  { key: 'fullrange', name: '全频', order: 1 },
  { key: 'sub', name: '超低', order: 2 }
];

SP.speakerRoleInfo = function (role) {
  for (var i = 0; i < SP.SPEAKER_ROLES.length; i++) {
    if (SP.SPEAKER_ROLES[i].key === role) return SP.SPEAKER_ROLES[i];
  }
  return SP.SPEAKER_ROLES[1];
};

SP.inferSpeakerRole = function (name) {
  name = String(name || '');
  if (/线阵|line/i.test(name)) return 'linearray';
  if (/超低|低音|sub/i.test(name)) return 'sub';
  return 'fullrange';
};

var BASE_TEMPLATES = [
  { type: 'mixer', name: 'WING RACK', ins: 24, outs: 8,
    mixerDefaults: { channels: 24, buses: 16, mains: 4, matrices: 8, mainMode: 'LR' } },
  { type: 'mixer', name: 'MR18', ins: 18, outs: 8,
    mixerDefaults: { channels: 16, buses: 0, mains: 1, matrices: 0, mainMode: 'Mono' } },
  { type: 'switch', name: 'Dante 交换机（8 网口）', ins: 8, outs: 0 },
  { type: 'dsp', name: 'Unit48', ins: 4, outs: 8 },
  { type: 'amp', name: '两通道功放（2进2出）', ins: 2, outs: 2 },
  { type: 'amp', name: '四通道功放（4进4出）', ins: 4, outs: 4 },
  { type: 'speaker', name: '线阵列音箱', ins: 1, outs: 1, speakerRole: 'linearray' },
  { type: 'speaker', name: '全频音箱', ins: 1, outs: 1, speakerRole: 'fullrange' },
  { type: 'speaker', name: '超低音箱', ins: 1, outs: 1, speakerRole: 'sub' }
];

function caseTemplate(type, name, ins, outs, specs, role) {
  var item = { type: type, name: name, ins: ins, outs: outs, specs: specs || {} };
  if (role) item.speakerRole = role;
  return item;
}

/* 正式版与体验版共用的 36 型号案例库。新用户开局即有，旧用户升级时只补缺失项。 */
SP.CASE_TEMPLATES = [
  caseTemplate('speaker', 'DO106', 1, 1, { powered: 'passive', power: 120, ohms: 8, size: '6.5' }, 'fullrange'),
  caseTemplate('speaker', 'DO108', 1, 1, { powered: 'passive', power: 150, ohms: 8, size: '8' }, 'fullrange'),
  caseTemplate('speaker', 'DO110', 1, 1, { powered: 'passive', power: 250, ohms: 8, size: '10' }, 'fullrange'),
  caseTemplate('speaker', 'DO112', 1, 1, { powered: 'passive', power: 300, ohms: 8, size: '12' }, 'fullrange'),
  caseTemplate('speaker', 'DO115', 1, 1, { powered: 'passive', power: 400, ohms: 8, size: '15' }, 'fullrange'),
  caseTemplate('speaker', 'DO115H', 1, 1, { powered: 'passive', power: 600, ohms: 8, size: '15' }, 'fullrange'),
  caseTemplate('speaker', 'DO215', 1, 1, { powered: 'passive', power: 800, ohms: 4, size: '双' }, 'fullrange'),
  caseTemplate('speaker', '206M', 2, 2, { powered: 'passive', power: 280, ohms: 12, size: '双' }, 'fullrange'),
  caseTemplate('speaker', 'DO115S', 1, 1, { powered: 'passive', power: 600, ohms: 8, size: '15' }, 'sub'),
  caseTemplate('speaker', 'DO118S', 1, 1, { powered: 'passive', power: 600, ohms: 8, size: '18' }, 'sub'),
  caseTemplate('speaker', 'DO218S', 1, 1, { powered: 'passive', power: 1200, ohms: 4, size: '双' }, 'sub'),
  caseTemplate('speaker', 'K212S', 1, 1, { powered: 'passive', power: 700, ohms: 4, size: '双' }, 'sub'),
  caseTemplate('speaker', 'K18S', 1, 1, { powered: 'passive', power: 600, ohms: 8, size: '18' }, 'sub'),
  caseTemplate('speaker', '有源双6寸', 1, 1, { powered: 'active', power: 350, size: '双6寸' }, 'fullrange'),
  caseTemplate('speaker', '有源超低18', 1, 1, { powered: 'active', power: 1200, size: '18' }, 'sub'),
  caseTemplate('amp', 'FA1500', 2, 2, { rackU: 3, power: 1500 }),
  caseTemplate('amp', 'FA1250', 2, 2, { rackU: 2, power: 1250 }),
  caseTemplate('amp', 'FA900', 2, 2, { rackU: 2, power: 900 }),
  caseTemplate('amp', 'FA700', 2, 2, { rackU: 2, power: 700 }),
  caseTemplate('amp', 'FA500', 2, 2, { rackU: 2, power: 500 }),
  caseTemplate('amp', 'SA2002', 2, 2, { rackU: 2, power: 2000 }),
  caseTemplate('amp', 'SA1402', 2, 2, { rackU: 2, power: 1400 }),
  caseTemplate('amp', 'SA1002', 2, 2, { rackU: 2, power: 1000 }),
  caseTemplate('amp', 'SA802', 2, 2, { rackU: 2, power: 800 }),
  caseTemplate('amp', 'SA602', 2, 2, { rackU: 1, power: 600 }),
  caseTemplate('amp', 'SA202', 2, 2, { rackU: 1, power: 200 }),
  caseTemplate('amp', 'SA2004', 4, 4, { rackU: 2, power: 2000 }),
  caseTemplate('amp', 'SA1404', 4, 4, { rackU: 2, power: 1400 }),
  caseTemplate('amp', 'SA1004', 4, 4, { rackU: 2, power: 1000 }),
  caseTemplate('amp', 'SA804', 4, 4, { rackU: 2, power: 800 }),
  caseTemplate('amp', 'SA604', 4, 4, { rackU: 1, power: 600 }),
  caseTemplate('dsp', 'Unit48', 4, 8, { rackU: 1 }),
  caseTemplate('dsp', 'DS48', 4, 8, { rackU: 1 }),
  caseTemplate('dsp', 'DS36', 3, 6, {}),
  caseTemplate('dsp', 'DS24', 2, 4, { rackU: 1 }),
  caseTemplate('mixer', 'WING RACK', 24, 8, { rackU: 3 })
];

SP.TEMPLATES = JSON.parse(JSON.stringify(BASE_TEMPLATES));
SP.CASE_TEMPLATES.forEach(function (item) {
  var idx = -1;
  SP.TEMPLATES.forEach(function (current, i) {
    if (current.type === item.type && current.name === item.name) idx = i;
  });
  if (idx >= 0) {
    var merged = Object.assign({}, SP.TEMPLATES[idx], JSON.parse(JSON.stringify(item)));
    if (SP.TEMPLATES[idx].mixerDefaults && !merged.mixerDefaults) {
      merged.mixerDefaults = JSON.parse(JSON.stringify(SP.TEMPLATES[idx].mixerDefaults));
    }
    SP.TEMPLATES[idx] = merged;
  }
  else SP.TEMPLATES.push(JSON.parse(JSON.stringify(item)));
});

SP.MIXER_TEMPLATES = [];

/* 规格显示：纯数字自动补单位，其余原样显示 */
SP.specString = function (d) {
  var s = d.specs || {};
  function clean(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }
  function fmt(v, u) {
    v = clean(v);
    return /^\d+(\.\d+)?$/.test(v) ? v + u : v;
  }
  var parts = [];
  if (d.type === 'amp') {
    if (s.power) parts.push(fmt(s.power, 'W') + '@8Ω');
    if (s.power4) parts.push(fmt(s.power4, 'W') + '@4Ω');
    if (s.ohms) parts.push('最低 ' + fmt(s.ohms, 'Ω'));
  }
  if (d.type === 'speaker') {
    parts.push(s.powered === 'active' ? '有源' : '无源');
    if (s.ohms) parts.push(fmt(s.ohms, 'Ω'));
    if (s.power) parts.push(fmt(s.power, 'W'));
    if (s.size) parts.push(fmt(s.size, '寸'));
  }
  if (d.type === 'switch' && d.inputs && d.inputs.length) {
    parts.push(d.inputs.length + ' 网口');
  }
  if ((d.type === 'mixer' || d.type === 'dsp' || d.type === 'amp') && s.rackU) {
    parts.push(fmt(s.rackU, 'U'));
  }
  return parts.join(' · ');
};

/* ---------- Store ---------- */

/* 本地存储配额告警：只弹一次，避免刷屏 */
SP.warnStorage = (function () {
  var warned = false;
  return function () {
    if (warned) return;
    warned = true;
    alert('警告：浏览器本地存储空间已满，最新改动可能没有保存！\n\n建议立即：\n1. 点顶栏「导出配置」备份当前数据；\n2. 删除不需要的配置槽或部分设备图片后重试。');
  };
})();

SP.Store = (function () {
  var demoMode = false;
  try { demoMode = new URLSearchParams(window.location.search || '').get('demo') === '1'; } catch (e) {}
  var KEY = demoMode ? 'erosiris-aurora-state-v2' : 'signalpath-v2';
  var LEGACY_KEY = demoMode ? '' : 'signalpath-v1';   /* 正式版继续兼容 v1；Demo 使用独立空白工程 */
  function userPath(section, relative) {
    var fallback = { speakerData:'speaker-data', performerPhotos:'performer-photos', performerModels:'performer-models', stageModels:'stage-models' };
    return SP.UserData ? SP.UserData.path(section, relative) : 'user-data/' + fallback[section] + '/' + relative;
  }

  function defaultMixer() {
    return { physIn: 16, channels: 16, buses: 6, mains: 2, matrices: 4, mainMode: 'LR',
      physOut: 8, routes: {}, links: [], inPatch: null, outPatch: {} };
  }

  function defaultPerformerMonitor() {
    return { type: 'IEM', mixes: 1, stereo: false, tap: 'inherit', stage: true, note: '' };
  }

  function defaultBaiLiTemplate() {
    return {
      id: 'perf-demo-baili',
      name: '白黎',
      characterType: 'performer',
      role: 'bassist',
      roleCustom: '',
      photoId: '',
      photoAsset: userPath('performerPhotos', 'baili/baili-front.png'),
      photoGallery: [
        { id:'baili-photo-front', imageId:'', asset:userPath('performerPhotos', 'baili/baili-front.png'), aspect:'9:16', name:'正面' },
        { id:'baili-photo-left-front', imageId:'', asset:userPath('performerPhotos', 'baili/baili-left-front.png'), aspect:'9:16', name:'左前侧' },
        { id:'baili-photo-back', imageId:'', asset:userPath('performerPhotos', 'baili/baili-back.png'), aspect:'9:16', name:'背面' }
      ],
      primaryPhotoKey: 'baili-photo-front',
      photoAspect: '9:16',
      modelAssetId: 'performer.bassist.baili',
      localModelId: '',
      modelFileName: 'baili.glb',
      modelFormat: 'glb',
      notes: '默认示范角色 · 白黎',
      sources: [{
        id: 'src-demo-baili-bass', name: 'Bass DI', device: '电 Bass', category: '乐器', connector: 'XLR',
        physicalInputs: 1, channels: 1, enabled: true, phantom: false, stage: true, note: ''
      }],
      monitor: defaultPerformerMonitor(),
      outputs: [],
      specialRoutes: ''
    };
  }

  function defaultErosDrummerTemplate() {
    return {
      id: 'perf-default-eros-drummer',
      name: 'Eros',
      characterType: 'performer',
      role: 'drummer',
      roleCustom: '',
      photoId: '',
      photoAsset: userPath('performerPhotos', 'eros-drummer/eros-drummer.png'),
      photoGallery: [
        { id:'eros-drummer-photo-main', imageId:'', asset:userPath('performerPhotos', 'eros-drummer/eros-drummer.png'), aspect:'9:16', name:'主艺术照' }
      ],
      primaryPhotoKey: 'eros-drummer-photo-main',
      photoAspect: '9:16',
      modelAssetId: 'performer.drummer.eros',
      localModelId: '',
      modelFileName: 'eros-drummer.glb',
      modelFormat: 'glb',
      notes: '默认鼓手模板 · Eros',
      sources: [{
        id: 'src-default-eros-drums', name: '鼓组拾音', device: '鼓组', category: '话筒', connector: 'XLR',
        physicalInputs: 8, channels: 8, enabled: true, phantom: false, stage: true, note: '可按实际鼓组麦克风拆分'
      }],
      monitor: Object.assign(defaultPerformerMonitor(), { type:'IEM', mixes:1, stereo:true, stage:true }),
      outputs: [],
      specialRoutes: '',
      stageDefaults: { x:1.04, y:2.65, z:0.6, rotation:0, scale:1, targetHeightM:1.631 }
    };
  }

  function defaultStageCatTemplate() {
    return {
      id: 'mascot-stage-cat',
      name: '舞台小猫',
      characterType: 'mascot',
      role: 'other',
      roleCustom: '吉祥物',
      photoId: '',
      photoAsset: userPath('performerPhotos', 'stage-cat/stage-cat.png'),
      photoGallery: [
        { id:'stage-cat-photo-main', imageId:'', asset:userPath('performerPhotos', 'stage-cat/stage-cat.png'), aspect:'9:16', name:'主艺术照' },
        { id:'stage-cat-photo-front', imageId:'', asset:userPath('performerPhotos', 'stage-cat/stage-cat-front.png'), aspect:'9:16', name:'小黑正面' },
        { id:'stage-cat-photo-side', imageId:'', asset:userPath('performerPhotos', 'stage-cat/stage-cat-side.png'), aspect:'9:16', name:'小黑侧面' }
      ],
      primaryPhotoKey: 'stage-cat-photo-main',
      photoAspect: '9:16',
      modelAssetId: 'mascot.stage-cat',
      localModelId: '',
      modelFileName: 'stage-cat.glb',
      modelFormat: 'glb',
      notes: '默认舞台吉祥物 · 可自由摆放，不占音频通道',
      sources: [],
      monitor: Object.assign(defaultPerformerMonitor(), { type:'无', mixes:0, stereo:false, stage:false }),
      outputs: [],
      specialRoutes: '',
      stageDefaults: { x:-0.42, y:-0.78, z:0.6, rotation:0, scale:1, targetHeightM:0.42 }
    };
  }

  function defaultShowPlan() {
    return { name: '本场演出', venueAssetId: '', previewImgId: '', notes: '', stageResult: null };
  }

  function defaultMixerPlanning() {
    return {
      doublePatchInputs: {},
      monitorTap: 'pre',
      outputPreset: 'classic4',
      mainOutputs: 2,
      mainAtStage: true,
      spareInputs: 0,
      spareChannels: 0,
      spareBuses: 0,
      spareMatrices: 0,
      spareOutputs: 0,
      outputTeachingOpen: false,
      sharePanelImage: true,
      inputPanelImgId: '',
      outputPanelImgId: '',
      notes: ''
    };
  }

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function defaultShowPerformer(template, id, stage) {
    var performer = clone(template);
    performer.id = id;
    performer.templateId = template.id;
    performer.sources.forEach(function (source, index) { source.id = id + '-src-' + (index + 1); });
    performer.outputs.forEach(function (output, index) { output.id = id + '-out-' + (index + 1); });
    performer.stage = Object.assign({
      zone: '', slotId: '', preferredSlotId: '', placementMode: 'free',
      x: null, y: null, z: 0.6, rotation: 0, scale: 1,
      modelAssetId: performer.modelAssetId || '', modelMode: 'inherit', actionId: 'idle',
      actionProfileId: '', manualLocked: true, posture: 'stand'
    }, stage || {});
    return performer;
  }

  function defaultShowRoster() {
    return [
      defaultShowPerformer(defaultBaiLiTemplate(), 'show-bass-01', {
        zone: 'Bass 手', preferredSlotId: '5', x: -1.17, y: -0.35,
        modelAssetId: 'performer.bassist.baili', posture: 'stand'
      }),
      defaultShowPerformer(defaultErosDrummerTemplate(), 'show-drum-01', {
        zone: '鼓组', preferredSlotId: '8', x: 1.04, y: 2.65,
        modelAssetId: 'performer.drummer.eros', posture: 'sit'
      })
    ];
  }

  function mainIds(m) {
    var n = Math.max(0, Math.min(64, +m.mains || 0));
    var arr = [];
    for (var i = 0; i < n; i++) arr.push('m' + i);
    return arr;
  }
  function normalizeTargetId(id) {
    if (id === 'ML' || id === 'MM') return 'm0';
    if (id === 'MR') return 'm1';
    return id;
  }
  function validTarget(m, id) {
    id = normalizeTargetId(id);
    if (id[0] === 'b') return +id.slice(1) < m.buses;
    if (id[0] === 'x') return +id.slice(1) < m.matrices;
    if (id[0] === 'm') return +id.slice(1) < m.mains;
    return false;
  }

  /* 台面数据补齐：物理输出 / 输入分配（默认 1:1 直通）/ 输出分配 */
  function normalizeMixer(m) {
    if (m.physOut === undefined || m.physOut === null) m.physOut = 8;
    if (m.mains === undefined || m.mains === null) m.mains = m.mainMode === 'Mono' ? 1 : 2;
    m.mains = Math.max(0, Math.min(64, +m.mains || 0));
    if (!m.links) m.links = [];
    if (!m.routes) m.routes = {};
    if (!m.outPatch) m.outPatch = {};
    if (!m.inPatch) {
      m.inPatch = {};
      var n = Math.min(m.physIn, m.channels);
      for (var i = 0; i < n; i++) m.inPatch[i] = [i];
    } else {
      var ip = {};
      Object.keys(m.inPatch).forEach(function (k) {
        if (+k >= m.physIn) return;
        var raw = Array.isArray(m.inPatch[k]) ? m.inPatch[k] : [];
        var arr = raw.filter(function (c) { return c >= 0 && c < m.channels; });
        if (arr.length) ip[k] = arr;
      });
      m.inPatch = ip;
    }
    var nr = {};
    Object.keys(m.routes || {}).forEach(function (ci) {
      if (+ci >= m.channels) return;
      var seen = {};
      var arr = (m.routes[ci] || []).map(normalizeTargetId).filter(function (t) {
        if (!validTarget(m, t) || seen[t]) return false;
        seen[t] = true;
        return true;
      });
      if (arr.length) nr[ci] = arr;
    });
    m.routes = nr;
    var op = {};
    Object.keys(m.outPatch).forEach(function (sid) {
      sid = normalizeTargetId(sid);
      if (!validTarget(m, sid)) return;
      var raw = Array.isArray(m.outPatch[sid]) ? m.outPatch[sid] : [];
      var arr = raw.filter(function (o) { return o >= 0 && o < m.physOut; });
      if (arr.length) op[sid] = arr;
    });
    m.outPatch = op;
    return m;
  }

  function defaultState() {
    return { devices: [], connections: [], customTypes: [], inputGear: [],
      userMixerTemplates: [], deviceTemplates: JSON.parse(JSON.stringify(SP.TEMPLATES)),
      deviceTemplatesVersion: 7, mixer: defaultMixer(), activeMixerId: '',
      performerTemplates: [defaultBaiLiTemplate(), defaultErosDrummerTemplate(), defaultStageCatTemplate()], performerTemplatesVersion: 8,
      showRoster: defaultShowRoster(), defaultShowRosterVersion: 1,
      defaultStageMascotVersion: 1, standbyRosters: [], showPlan: defaultShowPlan(),
      mixerPlanning: defaultMixerPlanning(),
      diagramLayout: 'bottomup', diagramOrient: 'v', seq: 1, quickPresets: [], reversePresets: [],
      powerAlarmMode: 'show',
      power: { eff: 0.7, headroom: 1.3, mixerW: 150, dspW: 50, seqW: 30 } };
  }

  /* v1 → v2 升级（幂等，可处理旧导入/旧配置槽数据）：
     图片 dataURL 入 IndexedDB 改存 id、线长数字化 lenM+note、功放 P/S/B 档按输出对存储 */
  function upgradeData(s) {
    (s.devices || []).forEach(function (d) {
      delete d.collapsed;   /* v2 框图节点不再支持收起 */
      if (d.img && /^data:/.test(d.img)) d.imgId = SP.Images.put(d.img);
      if (d.img !== undefined) delete d.img;
      if (d.panelImg && /^data:/.test(d.panelImg)) d.panelImgId = SP.Images.put(d.panelImg);
      if (d.panelImg !== undefined) delete d.panelImg;
      if (d.type === 'amp') {
        var pairs = Math.ceil((d.outputs || []).length / 2);
        if (!Array.isArray(d.ampPairModes)) {
          d.ampPairModes = [];
          for (var pi = 0; pi < pairs; pi++) {
            var a = d.outputs[pi * 2], b = d.outputs[pi * 2 + 1];
            d.ampPairModes.push(
              (a && a.mode === 'B') || (b && b.mode === 'B') ? 'B'
                : (a && a.mode === 'S') ? 'S' : 'P');
          }
        }
        while (d.ampPairModes.length < pairs) d.ampPairModes.push('P');
        d.ampPairModes.length = pairs;
        /* 接地从每输出口迁移为整机一个开关 */
        if (!d.specs) d.specs = {};
        if (d.specs.grounded === undefined) {
          d.specs.grounded = true;
        }
        (d.outputs || []).forEach(function (p) { if (p) delete p.grounded; });
      }
      /* DSP 内部矩阵/压限数据：清掉越界项 */
      if (d.dspRoute) {
        var mx = {};
        Object.keys(d.dspRoute.matrix || {}).forEach(function (k) {
          if (+k >= d.inputs.length) return;
          var raw = Array.isArray(d.dspRoute.matrix[k]) ? d.dspRoute.matrix[k] : [];
          var arr = raw.filter(function (o) { return o < d.outputs.length; });
          if (arr.length) mx[k] = arr;
        });
        d.dspRoute.matrix = mx;
        var lm = {};
        Object.keys(d.dspRoute.limits || {}).forEach(function (k) {
          if (+k < d.outputs.length) lm[k] = d.dspRoute.limits[k];
        });
        d.dspRoute.limits = lm;
      }
    });
    s.quickPresets = s.quickPresets || [];
    s.reversePresets = s.reversePresets || [];
    (s.connections || []).forEach(function (c) {
      if (c.lenM === undefined) {
        var raw = String(c.len || '');
        var m = raw.match(/(\d+(?:\.\d+)?)\s*(?:m|M|米)?/);
        c.lenM = m ? +m[1] : '';
        var rest = m ? raw.replace(m[0], '').trim() : raw.trim();
        if (rest && !c.note) c.note = rest;
      }
      if (c.len !== undefined) delete c.len;
      if (c.note === undefined) c.note = '';
    });
    (s.deviceTemplates || []).forEach(function (t) {
      if (!t.tplId) t.tplId = 'tpl' + (s.seq++);
    });
    if (!s.power) s.power = { eff: 0.7, headroom: 1.3, mixerW: 150, dspW: 50, seqW: 30 };
    if (!s.powerAlarmMode) s.powerAlarmMode = 'show';
  }

  function nonNegInt(v, fallback) {
    var n = Math.floor(+v);
    return isFinite(n) && n >= 0 ? n : (fallback || 0);
  }

  function plannedDoubleKey(performerId, sourceId, lineIndex) {
    return String(performerId || '') + '/' + String(sourceId || '') + '/' + nonNegInt(lineIndex, 0);
  }

  function validPerformerRole(role) {
    return SP.PERFORMER_ROLES.some(function (r) { return r.key === role; }) ? role : 'other';
  }

  function normalizePerformerData(p, s, rosterItem) {
    if (!p.id) p.id = (rosterItem ? 'show' : 'perf') + (s.seq++);
    p.name = String(p.name || (rosterItem ? '未命名乐手' : '新乐手'));
    p.role = validPerformerRole(p.role);
    p.roleCustom = String(p.roleCustom || '');
    p.photoId = p.photoId || '';
    p.photoAsset = String(p.photoAsset || '');
    p.photoGallery = Array.isArray(p.photoGallery) ? p.photoGallery : [];
    if (!p.photoGallery.length && (p.photoId || p.photoAsset)) {
      p.photoGallery.push({ id:'photo' + (s.seq++), imageId:p.photoId, asset:p.photoAsset,
        aspect:p.photoAspect === '16:9' ? '16:9' : '9:16', name:'艺术照' });
    }
    var photoKeys = {};
    p.photoGallery = p.photoGallery.map(function (photo, index) {
      photo = photo && typeof photo === 'object' ? photo : {};
      var key = String(photo.id || 'photo' + (s.seq++));
      while (photoKeys[key]) key = 'photo' + (s.seq++);
      photoKeys[key] = true;
      return {
        id:key,
        imageId:String(photo.imageId || ''),
        asset:String(photo.asset || ''),
        aspect:photo.aspect === '16:9' ? '16:9' : '9:16',
        name:String(photo.name || ('艺术照 ' + (index + 1)))
      };
    }).filter(function (photo) { return photo.imageId || photo.asset; });
    p.primaryPhotoKey = String(p.primaryPhotoKey || '');
    var primaryPhoto = p.photoGallery.filter(function (photo) { return photo.id === p.primaryPhotoKey; })[0] || p.photoGallery[0] || null;
    p.primaryPhotoKey = primaryPhoto ? primaryPhoto.id : '';
    p.photoId = primaryPhoto ? primaryPhoto.imageId : '';
    p.photoAsset = primaryPhoto ? primaryPhoto.asset : '';
    p.photoAspect = primaryPhoto ? primaryPhoto.aspect : (p.photoAspect === '16:9' ? '16:9' : '9:16');
    p.modelAssetId = p.modelAssetId || '';
    p.localModelId = String(p.localModelId || '');
    p.modelFileName = String(p.modelFileName || '');
    p.modelFormat = String(p.modelFormat || (p.localModelId ? 'fbx' : ''));
    p.characterType = p.characterType === 'mascot' ? 'mascot' : 'performer';
    p.stageDefaults = Object.assign({ x:0, y:0, z:0.6, rotation:0, scale:1, targetHeightM:0.45 }, p.stageDefaults || {});
    ['x','y','z','rotation'].forEach(function (key) {
      p.stageDefaults[key] = isFinite(+p.stageDefaults[key]) ? +p.stageDefaults[key] : (key === 'z' ? 0.6 : 0);
    });
    p.stageDefaults.scale = Math.max(0.1, isFinite(+p.stageDefaults.scale) ? +p.stageDefaults.scale : 1);
    p.stageDefaults.targetHeightM = Math.max(0.1, isFinite(+p.stageDefaults.targetHeightM) ? +p.stageDefaults.targetHeightM : 0.45);
    p.notes = String(p.notes || '');
    p.specialRoutes = String(p.specialRoutes || '');
    p.sources = Array.isArray(p.sources) ? p.sources : [];
    p.sources.forEach(function (src) {
      if (!src.id) src.id = 'src' + (s.seq++);
      src.name = String(src.name || '输入信号');
      src.device = String(src.device || '');
      if (SP.GEAR_CATS.indexOf(src.category) < 0) src.category = SP.GEAR_CATS[0];
      if (SP.PERFORMER_CONNECTORS.indexOf(src.connector) < 0) src.connector = 'XLR';
      src.physicalInputs = Math.max(1, nonNegInt(src.physicalInputs, 1));
      src.channels = Math.max(src.physicalInputs, nonNegInt(src.channels, src.physicalInputs));
      src.enabled = src.enabled !== false;
      src.phantom = !!src.phantom;
      src.stage = src.stage !== false;
      src.note = String(src.note || '');
    });
    p.monitor = Object.assign(defaultPerformerMonitor(), p.monitor || {});
    if (SP.MONITOR_TYPES.indexOf(p.monitor.type) < 0) p.monitor.type = 'IEM';
    p.monitor.mixes = nonNegInt(p.monitor.mixes, p.monitor.type === '无' ? 0 : 1);
    if (p.monitor.type === '无') p.monitor.mixes = 0;
    p.monitor.stereo = !!p.monitor.stereo;
    p.monitor.tap = p.monitor.tap === 'pre' || p.monitor.tap === 'post' ? p.monitor.tap : 'inherit';
    p.monitor.stage = p.monitor.stage !== false;
    p.monitor.note = String(p.monitor.note || '');
    p.outputs = Array.isArray(p.outputs) ? p.outputs : [];
    p.outputs.forEach(function (out) {
      if (!out.id) out.id = 'pout' + (s.seq++);
      out.name = String(out.name || '特殊输出');
      out.count = Math.max(1, nonNegInt(out.count, 1));
      if (SP.PERFORMER_CONNECTORS.indexOf(out.connector) < 0) out.connector = 'XLR';
      if (SP.ROUTE_TYPES.indexOf(out.routeType) < 0) out.routeType = 'direct';
      out.stage = out.stage !== false;
      out.note = String(out.note || '');
    });
    if (p.characterType === 'mascot') {
      p.role = 'other';
      p.roleCustom = '吉祥物';
      p.sources = [];
      p.monitor = Object.assign(defaultPerformerMonitor(), { type:'无', mixes:0, stereo:false, stage:false });
      p.outputs = [];
      p.specialRoutes = '';
    }
    if (rosterItem) {
      p.templateId = p.templateId || '';
      p.stage = Object.assign({ zone: '', x: null, y: null, rotation: 0, modelAssetId: '' }, p.stage || {});
      p.stage.zone = String(p.stage.zone || '');
      p.stage.modelAssetId = p.stage.modelAssetId || p.modelAssetId || '';
      ['x', 'y'].forEach(function (k) {
        if (p.stage[k] === '' || p.stage[k] === undefined || p.stage[k] === null) p.stage[k] = null;
        else p.stage[k] = isFinite(+p.stage[k]) ? +p.stage[k] : null;
      });
      p.stage.rotation = isFinite(+p.stage.rotation) ? +p.stage.rotation : 0;
    }
    return p;
  }

  function normalizeShowWorkflow(s) {
    s.performerTemplates = Array.isArray(s.performerTemplates) ? s.performerTemplates : [];
    if (!s.performerTemplatesVersion || s.performerTemplatesVersion < 1) {
      var hasBaiLi = s.performerTemplates.some(function (p) {
        return p && (p.id === 'perf-demo-baili' || p.modelAssetId === 'performer.bassist.baili');
      });
      if (!hasBaiLi) s.performerTemplates.unshift(defaultBaiLiTemplate());
      s.performerTemplatesVersion = 1;
    }
    if (s.performerTemplatesVersion < 2) {
      var baiLi = s.performerTemplates.filter(function (p) {
        return p && (p.id === 'perf-demo-baili' || p.modelAssetId === 'performer.bassist.baili');
      })[0];
      if (!baiLi) {
        baiLi = defaultBaiLiTemplate();
        s.performerTemplates.unshift(baiLi);
      } else {
        var builtIn = defaultBaiLiTemplate();
        var customPhoto = baiLi.photoId || (baiLi.photoAsset && baiLi.photoAsset.indexOf('performer-bassist-baili.png') < 0 ? baiLi.photoAsset : '');
        var gallery = Array.isArray(baiLi.photoGallery) ? baiLi.photoGallery.slice() : [];
        if (customPhoto && !gallery.length) {
          gallery.push({ id:'baili-photo-custom', imageId:baiLi.photoId || '', asset:baiLi.photoId ? '' : baiLi.photoAsset,
            aspect:baiLi.photoAspect === '16:9' ? '16:9' : '9:16', name:'自定义主图' });
          baiLi.primaryPhotoKey = 'baili-photo-custom';
        }
        builtIn.photoGallery.forEach(function (photo) {
          if (!gallery.some(function (current) { return current.asset === photo.asset; })) gallery.push(clone(photo));
        });
        baiLi.photoGallery = gallery;
        baiLi.primaryPhotoKey = baiLi.primaryPhotoKey || 'baili-photo-front';
        baiLi.modelAssetId = baiLi.modelAssetId || builtIn.modelAssetId;
        baiLi.modelFileName = baiLi.modelFileName || builtIn.modelFileName;
        baiLi.modelFormat = baiLi.modelFormat || builtIn.modelFormat;
      }
      s.performerTemplatesVersion = 2;
    }
    if (s.performerTemplatesVersion < 3) {
      var baiLiV3 = s.performerTemplates.filter(function (p) {
        return p && (p.id === 'perf-demo-baili' || p.modelAssetId === 'performer.bassist.baili');
      })[0];
      if (!baiLiV3) {
        baiLiV3 = defaultBaiLiTemplate();
        s.performerTemplates.unshift(baiLiV3);
      }
      if (['Bass手', 'Bass 手', '贝斯手', 'Bass手·白黎'].indexOf(String(baiLiV3.name || '').trim()) >= 0) baiLiV3.name = '白黎';
      baiLiV3.modelAssetId = 'performer.bassist.baili';
      if (!baiLiV3.localModelId) {
        baiLiV3.modelFileName = 'baili.glb';
        baiLiV3.modelFormat = 'glb';
      }
      s.performerTemplatesVersion = 3;
    }
    if (s.performerTemplatesVersion < 4) {
      s.performerTemplates.forEach(function (p) {
        if (p && p.characterType !== 'mascot') p.characterType = 'performer';
      });
      s.performerTemplatesVersion = 4;
    }
    if (s.performerTemplatesVersion < 5) {
      var stageCat = s.performerTemplates.filter(function (p) {
        return p && (p.id === 'mascot-stage-cat' || p.modelAssetId === 'mascot.stage-cat');
      })[0];
      if (!stageCat) {
        s.performerTemplates.push(defaultStageCatTemplate());
      } else {
        stageCat.characterType = 'mascot';
        stageCat.modelAssetId = 'mascot.stage-cat';
        if (!stageCat.localModelId) {
          stageCat.modelFileName = 'stage-cat.glb';
          stageCat.modelFormat = 'glb';
        }
      }
      s.performerTemplatesVersion = 5;
    }
    if (s.performerTemplatesVersion < 6) {
      var erosDrummer = s.performerTemplates.filter(function (p) {
        return p && (p.id === 'perf-default-eros-drummer' || p.modelAssetId === 'performer.drummer.eros');
      })[0];
      if (!erosDrummer) {
        erosDrummer = defaultErosDrummerTemplate();
        var firstMascotIndex = s.performerTemplates.findIndex(function (p) { return p && p.characterType === 'mascot'; });
        if (firstMascotIndex < 0) s.performerTemplates.push(erosDrummer);
        else s.performerTemplates.splice(firstMascotIndex, 0, erosDrummer);
      } else {
        erosDrummer.characterType = 'performer';
        erosDrummer.role = 'drummer';
        erosDrummer.modelAssetId = 'performer.drummer.eros';
        if (!erosDrummer.localModelId) {
          erosDrummer.modelFileName = 'eros-drummer.glb';
          erosDrummer.modelFormat = 'glb';
        }
      }
      s.performerTemplatesVersion = 6;
    }
    if (s.performerTemplatesVersion < 7) {
      var stageCatV7 = s.performerTemplates.filter(function (p) {
        return p && (p.id === 'mascot-stage-cat' || p.modelAssetId === 'mascot.stage-cat');
      })[0];
      var builtInCat = defaultStageCatTemplate();
      if (!stageCatV7) {
        s.performerTemplates.push(builtInCat);
      } else {
        stageCatV7.photoGallery = Array.isArray(stageCatV7.photoGallery) ? stageCatV7.photoGallery : [];
        if (!stageCatV7.photoGallery.some(function (photo) { return photo.asset === builtInCat.photoAsset; })) {
          stageCatV7.photoGallery.push(clone(builtInCat.photoGallery[0]));
        }
        stageCatV7.photoAsset = stageCatV7.photoAsset || builtInCat.photoAsset;
        stageCatV7.primaryPhotoKey = stageCatV7.primaryPhotoKey || builtInCat.primaryPhotoKey;
        var oldDefaults = stageCatV7.stageDefaults || {};
        if ((+oldDefaults.x === 6.5 && +oldDefaults.y === -3) || oldDefaults.x === undefined || oldDefaults.y === undefined) {
          stageCatV7.stageDefaults = clone(builtInCat.stageDefaults);
        }
      }
      s.performerTemplatesVersion = 7;
    }
    if (s.performerTemplatesVersion < 8) {
      var stageCatV8 = s.performerTemplates.filter(function (p) {
        return p && (p.id === 'mascot-stage-cat' || p.modelAssetId === 'mascot.stage-cat');
      })[0];
      var builtInCatV8 = defaultStageCatTemplate();
      if (!stageCatV8) {
        s.performerTemplates.push(builtInCatV8);
      } else {
        stageCatV8.photoGallery = Array.isArray(stageCatV8.photoGallery) ? stageCatV8.photoGallery : [];
        builtInCatV8.photoGallery.forEach(function (photo) {
          if (!stageCatV8.photoGallery.some(function (current) { return current.asset === photo.asset; })) {
            stageCatV8.photoGallery.push(clone(photo));
          }
        });
      }
      s.performerTemplatesVersion = 8;
    }
    s.showRoster = Array.isArray(s.showRoster) ? s.showRoster : [];
    s.standbyRosters = Array.isArray(s.standbyRosters) ? s.standbyRosters : [];
    s.performerTemplates.forEach(function (p) { normalizePerformerData(p, s, false); });
    if (!s.defaultShowRosterVersion || s.defaultShowRosterVersion < 1) {
      defaultShowRoster().forEach(function (builtIn) {
        var exists = s.showRoster.some(function (current) {
          return current && (current.id === builtIn.id || current.templateId === builtIn.templateId ||
            current.modelAssetId === builtIn.modelAssetId);
        });
        if (!exists) s.showRoster.push(builtIn);
      });
      s.defaultShowRosterVersion = 1;
    }
    s.showRoster.forEach(function (p) { normalizePerformerData(p, s, true); });
    s.standbyRosters.forEach(function (r, ri) {
      if (!r.id) r.id = 'standby' + (s.seq++);
      r.name = String(r.name || ('预备场 ' + (ri + 1)));
      r.entryTime = String(r.entryTime || '');
      r.members = Array.isArray(r.members) ? r.members : [];
      r.members.forEach(function (p) {
        normalizePerformerData(p, s, true);
        p.entryTime = String(p.entryTime || '');
      });
    });
    s.showPlan = Object.assign(defaultShowPlan(), s.showPlan || {});
    s.showPlan.name = String(s.showPlan.name || '本场演出');
    s.showPlan.venueAssetId = s.showPlan.venueAssetId || '';
    s.showPlan.previewImgId = s.showPlan.previewImgId || '';
    s.showPlan.notes = String(s.showPlan.notes || '');
    if (!s.defaultStageMascotVersion || s.defaultStageMascotVersion < 1) {
      if (s.showPlan.stageResult && SP.StageAssets && SP.StageAssets.ensureDefaultMascot) {
        s.showPlan.stageResult = SP.StageAssets.ensureDefaultMascot(s.showPlan.stageResult);
      }
      s.defaultStageMascotVersion = 1;
    }
    if (SP.StageAssets && SP.StageAssets.normalizeState) SP.StageAssets.normalizeState(s);
    s.mixerPlanning = Object.assign(defaultMixerPlanning(), s.mixerPlanning || {});
    var mp = s.mixerPlanning;
    var legacyDoubleAll = !!mp.doublePatch;
    mp.doublePatchInputs = mp.doublePatchInputs && typeof mp.doublePatchInputs === 'object'
      ? mp.doublePatchInputs : {};
    var cleanDouble = {};
    Object.keys(mp.doublePatchInputs).forEach(function (k) {
      if (mp.doublePatchInputs[k]) cleanDouble[k] = true;
    });
    if (legacyDoubleAll) {
      s.showRoster.forEach(function (p) {
        (p.sources || []).forEach(function (src) {
          if (src.enabled === false) return;
          for (var li = 0; li < src.physicalInputs; li++) {
            cleanDouble[plannedDoubleKey(p.id, src.id, li)] = true;
          }
        });
      });
    }
    mp.doublePatchInputs = cleanDouble;
    if (mp.doublePatch !== undefined) delete mp.doublePatch;
    mp.monitorTap = mp.monitorTap === 'post' ? 'post' : 'pre';
    mp.outputPreset = ['classic4', 'mainOnly', 'custom'].indexOf(mp.outputPreset) >= 0
      ? mp.outputPreset : 'classic4';
    mp.mainOutputs = nonNegInt(mp.mainOutputs, 2);
    mp.mainAtStage = mp.mainAtStage !== false;
    ['spareInputs', 'spareChannels', 'spareBuses', 'spareMatrices', 'spareOutputs'].forEach(function (k) {
      mp[k] = nonNegInt(mp[k], 0);
    });
    mp.outputTeachingOpen = !!mp.outputTeachingOpen;
    mp.sharePanelImage = mp.sharePanelImage !== false;
    mp.inputPanelImgId = mp.inputPanelImgId || '';
    mp.outputPanelImgId = mp.outputPanelImgId || '';
    mp.notes = String(mp.notes || '');
  }

  /* 旧版本数据 / 导入数据补齐缺失字段 */
  function normalize(s) {
    s.inputGear = s.inputGear || [];
    s.userMixerTemplates = s.userMixerTemplates || [];
    if (!s.diagramLayout) s.diagramLayout = 'bottomup';
    if (s.diagramOrient !== 'h') s.diagramOrient = 'v';
    upgradeData(s);
    normalizeShowWorkflow(s);
    /* v7：补齐案例库，并修正旧案例 WING RACK 被同名条目覆盖成 16 IN 的问题。 */
    if (!Array.isArray(s.deviceTemplates) || !s.deviceTemplates.length) {
      s.deviceTemplates = JSON.parse(JSON.stringify(SP.TEMPLATES));
      s.deviceTemplatesVersion = 7;
    } else if (s.deviceTemplatesVersion !== 7) {
      var seeds = JSON.parse(JSON.stringify(SP.TEMPLATES));
      var seen = {};
      s.deviceTemplates.forEach(function (t) { seen[t.type + '\n' + t.name] = true; });
      seeds.forEach(function (t) {
        var key = t.type + '\n' + t.name;
        if (!seen[key]) { s.deviceTemplates.push(t); seen[key] = true; }
      });
      s.deviceTemplates.forEach(function (t) {
        if (t.type !== 'mixer' || t.name !== 'WING RACK') return;
        t.ins = 24;
        t.outs = 8;
        t.mixerDefaults = { channels: 24, buses: 16, mains: 4, matrices: 8, mainMode: 'LR' };
      });
      s.deviceTemplatesVersion = 7;
    }
    if (s.mixer) normalizeMixer(s.mixer);
    (s.devices || []).forEach(function (d) {
      if (!d.color) d.color = SP.typeColor(d.type);
      if (!d.specs) d.specs = {};
      if (d.type === 'amp') {
        if (d.specs.grounded === undefined) d.specs.grounded = true;
        (d.outputs || []).forEach(function (p) { if (p) delete p.grounded; });
      }
      if (d.type === 'dsp') ensureDspRoute(d);
      if (d.type === 'speaker') {
        if (!d.speakerRole) d.speakerRole = SP.inferSpeakerRole(d.name);
        if (d.specs.powered !== 'active') d.specs.powered = 'passive';
        if (d.reverseParallel) {
          var rp = d.reverseParallel;
          if (!rp.groupId) rp.groupId = '';
          rp.parallel = Math.max(1, +rp.parallel || 1);
          rp.groupSize = Math.max(1, +rp.groupSize || rp.parallel);
          rp.index = Math.max(1, +rp.index || 1);
          rp.channel = Math.max(1, +rp.channel || 1);
          rp.locked = rp.locked !== false;
        }
      }
    });
    (s.connections || []).forEach(function (c) {
      if (c.cable === undefined) c.cable = '';
      if (c.color === undefined) c.color = '';
    });
    /* 桥接对的被合并端口上不允许保留连线 */
    s.connections = (s.connections || []).filter(function (c) {
      var sd = null;
      for (var i = 0; i < (s.devices || []).length; i++) {
        if (s.devices[i].id === c.sid) { sd = s.devices[i]; break; }
      }
      if (!sd || sd.type !== 'amp' || c.sport % 2 !== 1) return true;
      return (sd.ampPairModes || [])[(c.sport - 1) / 2] !== 'B';
    });
    /* 接线教学：乐器清单条目补 id；调音台的输入接线表清理失效项 */
    (s.inputGear || []).forEach(function (g) {
      if (!g.id) g.id = 'g' + (s.seq++);
    });
    /* Dante 分配字段补齐（仅调音台）：清越界端口 + 去重排序（不再限 4 路，支持全选） */
    (s.devices || []).forEach(function (d) {
      if (d.type !== 'mixer') return;
      ['danteIn', 'danteOut'].forEach(function (k) {
        var max = k === 'danteIn' ? (d.inputs || []).length : (d.outputs || []).length;
        var seen = {};
        d[k] = (Array.isArray(d[k]) ? d[k] : [])
          .filter(function (i) {
            if (i < 0 || i >= max || seen[i]) return false;
            seen[i] = true; return true;
          })
          .sort(function (a, b) { return a - b; });
      });
    });
    (s.devices || []).forEach(function (d) {
      if (d.type !== 'mixer') return;
      if (!d.gearPatch) { d.gearPatch = {}; return; }
      var gp = {};
      Object.keys(d.gearPatch).forEach(function (k) {
        var gid = d.gearPatch[k];
        if (+k < d.inputs.length &&
            (s.inputGear || []).some(function (g) { return g.id === gid; })) {
          gp[k] = gid;
        }
      });
      d.gearPatch = gp;
    });
    /* 多调音台：旧全局台面数据迁移给第一台调音台；校正活动台 id */
    var mixDevs = (s.devices || []).filter(function (d) { return d.type === 'mixer'; });
    mixDevs.forEach(function (d, i) {
      if (!d.mixer && i === 0 && s.mixer) {
        d.mixer = JSON.parse(JSON.stringify(s.mixer));
      }
      if (d.mixer) normalizeMixer(d.mixer);
    });
    if (!s.activeMixerId || !mixDevs.some(function (d) { return d.id === s.activeMixerId; })) {
      s.activeMixerId = mixDevs.length ? mixDevs[0].id : '';
    }
    return s;
  }

  function snapshotState() { return JSON.stringify(state); }
  function snapshotMixer() { return JSON.stringify(M() || defaultMixer()); }
  function snapshotArea(name) {
    if (name === 'diagram') {
      return JSON.stringify({
        diagramLayout: state.diagramLayout || 'bottomup',
        diagramOrient: state.diagramOrient || 'v',
        connections: state.connections,
        devices: state.devices.map(function (d) {
          return {
            id: d.id,
            px: d.px === undefined ? null : d.px,
            py: d.py === undefined ? null : d.py,
            collapsed: !!d.collapsed
          };
        })
      });
    }
    if (name === 'mixerDiagram') return snapshotMixer();
    if (name === 'inPatch') return JSON.stringify(M().inPatch || {});
    if (name === 'routeGrid') return JSON.stringify({ routes: M().routes || {}, links: M().links || [] });
    if (name === 'outPatch') return JSON.stringify(M().outPatch || {});
    return '';
  }
  function restoreAreaSnapshot(name, snap) {
    var data = JSON.parse(snap);
    if (name === 'diagram') {
      state.diagramLayout = data.diagramLayout || 'bottomup';
      state.diagramOrient = data.diagramOrient === 'h' ? 'h' : 'v';
      if (data.connections) state.connections = data.connections;
      var map = {};
      (data.devices || []).forEach(function (d) { map[d.id] = d; });
      state.devices.forEach(function (d) {
        var x = map[d.id];
        if (!x) return;
        if (x.px === null || x.px === undefined) delete d.px; else d.px = x.px;
        if (x.py === null || x.py === undefined) delete d.py; else d.py = x.py;
        d.collapsed = !!x.collapsed;
      });
    } else if (name === 'mixerDiagram') {
      setMixerData(normalizeMixer(Object.assign(defaultMixer(), data)));
    } else if (name === 'inPatch') {
      var m1 = M();
      m1.inPatch = data || {};
      normalizeMixer(m1);
    } else if (name === 'routeGrid') {
      var m2 = M();
      m2.routes = data.routes || {};
      m2.links = data.links || [];
      normalizeMixer(m2);
    } else if (name === 'outPatch') {
      var m3 = M();
      m3.outPatch = data || {};
      normalizeMixer(m3);
    }
    save({ noHistory: true });
  }
  function trimStack(a) {
    var max = 80;
    while (a.length > max) a.shift();
  }
  var AREA_NAMES = ['diagram', 'mixerDiagram', 'inPatch', 'routeGrid', 'outPatch'];

  var state;
  try {
    var raw = localStorage.getItem(KEY) || (LEGACY_KEY && localStorage.getItem(LEGACY_KEY));
    if (raw) {
      var parsed = JSON.parse(raw);
      state = Object.assign(defaultState(), parsed);
      if (!Object.prototype.hasOwnProperty.call(parsed, 'defaultShowRosterVersion')) state.defaultShowRosterVersion = 0;
      if (!Object.prototype.hasOwnProperty.call(parsed, 'defaultStageMascotVersion')) state.defaultStageMascotVersion = 0;
      state.mixer = Object.assign(defaultMixer(), state.mixer);
      normalize(state);
    }
  } catch (e) { /* 损坏数据回退到默认 */ }
  var firstRun = !state;
  if (!state) state = defaultState();
  var undoStack = [], redoStack = [];
  var areaStacks = {};
  AREA_NAMES.forEach(function (name) { areaStacks[name] = { undo: [], redo: [] }; });
  var lastSnapshot = snapshotState();
  var lastAreaSnapshots = {};
  AREA_NAMES.forEach(function (name) { lastAreaSnapshots[name] = snapshotArea(name); });

  /* 批量事务：期间所有 save 跳过，结束时统一存一次 → 撤销时整批 = 一步 */
  var batching = false;
  function batch(fn) {
    batching = true;
    try { fn(); } finally { batching = false; }
    save();
  }

  function save(opt) {
    if (batching) return;
    opt = opt || {};
    var snap = snapshotState();
    var areaSnaps = {};
    AREA_NAMES.forEach(function (name) { areaSnaps[name] = snapshotArea(name); });
    if (!opt.noHistory) {
      if (lastSnapshot && snap !== lastSnapshot) {
        undoStack.push(lastSnapshot);
        trimStack(undoStack);
        redoStack = [];
      }
      AREA_NAMES.forEach(function (name) {
        if (lastAreaSnapshots[name] && areaSnaps[name] !== lastAreaSnapshots[name]) {
          areaStacks[name].undo.push(lastAreaSnapshots[name]);
          trimStack(areaStacks[name].undo);
          areaStacks[name].redo = [];
        }
      });
    }
    lastSnapshot = snap;
    AREA_NAMES.forEach(function (name) { lastAreaSnapshots[name] = areaSnaps[name]; });
    var stored = true;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { stored = false; if (SP.warnStorage) SP.warnStorage(); }
    var el = document.getElementById('save-indicator');
    if (el) {
      if (stored) {
        var t = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        el.textContent = '已保存 ' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + ':' + pad(t.getSeconds());
        el.classList.add('flash');
        setTimeout(function () { el.classList.remove('flash'); }, 900);
      } else {
        el.textContent = '⚠ 存储已满，未保存';
      }
    }
    if (SP.updateHistoryButtons) SP.updateHistoryButtons();
    if (SP.onStoreSaved && !opt.skipConfig) SP.onStoreSaved(state);
  }

  function restoreWholeSnapshot(snap) {
    var parsed = JSON.parse(snap);
    state = Object.assign(defaultState(), parsed);
    if (!Object.prototype.hasOwnProperty.call(parsed, 'defaultShowRosterVersion')) state.defaultShowRosterVersion = 0;
    if (!Object.prototype.hasOwnProperty.call(parsed, 'defaultStageMascotVersion')) state.defaultStageMascotVersion = 0;
    state.mixer = Object.assign(defaultMixer(), state.mixer || {});
    normalize(state);
    save({ noHistory: true });
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(snapshotState());
    trimStack(redoStack);
    restoreWholeSnapshot(undoStack.pop());
    return true;
  }
  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(snapshotState());
    trimStack(undoStack);
    restoreWholeSnapshot(redoStack.pop());
    return true;
  }
  function canUndo() { return !!undoStack.length; }
  function canRedo() { return !!redoStack.length; }

  function resetHistory() {
    undoStack = []; redoStack = [];
    AREA_NAMES.forEach(function (name) { areaStacks[name] = { undo: [], redo: [] }; });
    lastSnapshot = snapshotState();
    AREA_NAMES.forEach(function (name) { lastAreaSnapshots[name] = snapshotArea(name); });
    if (SP.updateHistoryButtons) SP.updateHistoryButtons();
  }

  function undoArea(name) {
    var h = areaStacks[name];
    if (!h || !h.undo.length) return false;
    h.redo.push(snapshotArea(name));
    trimStack(h.redo);
    restoreAreaSnapshot(name, h.undo.pop());
    return true;
  }
  function redoArea(name) {
    var h = areaStacks[name];
    if (!h || !h.redo.length) return false;
    h.undo.push(snapshotArea(name));
    trimStack(h.undo);
    restoreAreaSnapshot(name, h.redo.pop());
    return true;
  }
  function canUndoArea(name) { return !!(areaStacks[name] && areaStacks[name].undo.length); }
  function canRedoArea(name) { return !!(areaStacks[name] && areaStacks[name].redo.length); }

  function uid() { return 'd' + (state.seq++); }

  /* ---------- 设备类型 ---------- */

  function typeInfo(type) {
    if (SP.DEVICE_TYPES[type]) return SP.DEVICE_TYPES[type];
    for (var i = 0; i < state.customTypes.length; i++) {
      if (state.customTypes[i].key === type) return state.customTypes[i];
    }
    return { name: type, abbr: 'DEV' };
  }

  function addCustomType(name) {
    var key = 'ct' + (state.seq++);
    var abbr = name.replace(/\s/g, '').slice(0, 3).toUpperCase() || 'DEV';
    state.customTypes.push({ key: key, name: name, abbr: abbr });
    return key;
  }

  /* ---------- 设备 ---------- */

  function makePorts(count, labels, prefix, isAmpOut) {
    var arr = [];
    for (var i = 0; i < count; i++) {
      var p = { label: (labels && labels[i]) ? labels[i] : prefix + ' ' + (i + 1) };
      if (isAmpOut) p.gain = '';
      arr.push(p);
    }
    return arr;
  }

  function makeDevice(opt) {
    var dev = {
      id: uid(),
      type: opt.type,
      name: opt.name,
      color: opt.color || SP.typeColor(opt.type),
      imgId: '',
      tplId: opt.tplId || '',
      speakerRole: opt.type === 'speaker' ? (opt.speakerRole || 'fullrange') : '',
      specs: opt.specs || {},
      inputs: makePorts(opt.ins, opt.inLabels, 'IN', false),
      outputs: makePorts(opt.outs, opt.outLabels, 'OUT', opt.type === 'amp')
    };
    if (dev.type === 'amp') {
      if (dev.specs.grounded === undefined) dev.specs.grounded = true;
      dev.ampPairModes = [];
      /* 新功放默认 S 档（立体声，两路独立） */
      for (var pi = 0; pi < Math.ceil(dev.outputs.length / 2); pi++) dev.ampPairModes.push('S');
    }
    if (dev.type === 'dsp') ensureDspRoute(dev);
    if (dev.type === 'switch') {
      dev.inputs.forEach(function (p, i) { p.label = '网口 ' + (i + 1); });
    }
    if (dev.type === 'speaker' && dev.specs.powered !== 'active') dev.specs.powered = 'passive';
    if (dev.type === 'mixer') {
      dev.mixer = defaultMixerFor(dev, opt.mixerDefaults || null);
      if (!activeMixerDev()) state.activeMixerId = dev.id;
    }
    return dev;
  }

  function addDevice(opt) {
    var dev = makeDevice(opt);
    state.devices.push(dev);
    save();
    return dev;
  }

  function addDevices(opts) {
    var added = [];
    (opts || []).forEach(function (opt) {
      var dev = makeDevice(opt);
      state.devices.push(dev);
      added.push(dev);
    });
    if (added.length) save();
    return added;
  }

  function getDevice(id) {
    for (var i = 0; i < state.devices.length; i++) {
      if (state.devices[i].id === id) return state.devices[i];
    }
    return null;
  }

  function removeDevice(id) {
    state.devices = state.devices.filter(function (d) { return d.id !== id; });
    state.connections = state.connections.filter(function (c) {
      return c.sid !== id && c.tid !== id;
    });
    if (state.activeMixerId === id) {
      var mds = mixerDevices();
      state.activeMixerId = mds.length ? mds[0].id : '';
    }
    save();
  }

  /* 批量删除（框选 + Delete）：整批 = 一步撤销 */
  function removeDevices(ids) {
    if (!ids || !ids.length) return 0;
    var n = 0;
    batch(function () {
      ids.forEach(function (id) {
        if (getDevice(id)) { removeDevice(id); n++; }
      });
    });
    return n;
  }

  /* 清空全部设备与连线（可撤销） */
  function clearAllDevices() {
    var n = state.devices.length;
    if (n) {
      batch(function () {
        state.devices = [];
        state.connections = [];
        state.activeMixerId = '';
      });
    }
    return n;
  }

  /* ---------- DSP 内部矩阵 + 输出压限（RMS / PEAK Limit） ---------- */

  function ensureDspRoute(d) {
    if (!d.dspRoute) {
      d.dspRoute = { matrix: {}, limits: {} };
      var n = Math.min(d.inputs.length, d.outputs.length);
      for (var i = 0; i < n; i++) d.dspRoute.matrix[i] = [i];   /* 默认 1:1 直通 */
    } else {
      if (!d.dspRoute.matrix) d.dspRoute.matrix = {};
      if (!d.dspRoute.limits) d.dspRoute.limits = {};
    }
    var mx = {};
    Object.keys(d.dspRoute.matrix || {}).forEach(function (k) {
      var inIdx = +k;
      if (inIdx < 0 || inIdx >= d.inputs.length) return;
      var seen = {};
      var raw = Array.isArray(d.dspRoute.matrix[k]) ? d.dspRoute.matrix[k] : [];
      var arr = raw.filter(function (o) {
        o = +o;
        if (o < 0 || o >= d.outputs.length || seen[o]) return false;
        seen[o] = true;
        return true;
      });
      if (arr.length) mx[inIdx] = arr;
    });
    d.dspRoute.matrix = mx;
    var lm = {};
    Object.keys(d.dspRoute.limits || {}).forEach(function (k) {
      if (+k >= 0 && +k < d.outputs.length) lm[k] = d.dspRoute.limits[k];
    });
    d.dspRoute.limits = lm;
    return d.dspRoute;
  }
  function hasDspRoute(dev, inIdx, outIdx) {
    var r = ensureDspRoute(dev).matrix[inIdx];
    return !!r && r.indexOf(outIdx) >= 0;
  }
  function toggleDspRoute(devId, inIdx, outIdx) {
    var d = getDevice(devId);
    if (!d) return;
    var m = ensureDspRoute(d).matrix;
    var r = m[inIdx] || (m[inIdx] = []);
    var i = r.indexOf(outIdx);
    if (i >= 0) r.splice(i, 1); else r.push(outIdx);
    if (!r.length) delete m[inIdx];
    save();
  }
  function setDspLimit(devId, outIdx, key, val) {
    var d = getDevice(devId);
    if (!d) return;
    var lm = ensureDspRoute(d).limits;
    var o = lm[outIdx] || (lm[outIdx] = {});
    val = String(val || '').trim();
    if (val) o[key] = val; else delete o[key];
    if (!Object.keys(o).length) delete lm[outIdx];
    save();
  }

  /* ---------- 快速布局预设模板 ---------- */

  function addQuickPreset(name, data) {
    state.quickPresets.push({ name: name, data: data });
    save();
  }
  function removeQuickPreset(idx) {
    state.quickPresets.splice(idx, 1);
    save();
  }

  function addReversePreset(name, data) {
    state.reversePresets = state.reversePresets || [];
    var p = { name: name, data: JSON.parse(JSON.stringify(data || {})) };
    var idx = -1;
    state.reversePresets.forEach(function (x, i) { if (x.name === name) idx = i; });
    if (idx >= 0) state.reversePresets[idx] = p; else state.reversePresets.push(p);
    save();
  }

  function removeReversePreset(idx) {
    state.reversePresets = state.reversePresets || [];
    state.reversePresets.splice(idx, 1);
    save();
  }

  /* ---------- 设备 → 模板（存为模板 / 一键模板） ---------- */

  function baseNameOf(name) {
    return String(name || '').replace(/\s*\d+号$/, '').trim();
  }

  /* 按名称去重：已有同名模板则更新，否则新增；设备回填 tplId 以便后续同步 */
  function saveDeviceAsTemplate(dev) {
    var base = baseNameOf(dev.name) || dev.name;
    var t = {
      type: dev.type,
      name: base,
      ins: dev.inputs.length,
      outs: dev.outputs.map(function (p) { return p.label; }),
      specs: JSON.parse(JSON.stringify(dev.specs || {})),
      color: dev.color || ''
    };
    if (dev.type === 'speaker') t.speakerRole = dev.speakerRole || 'fullrange';
    var idx = -1;
    state.deviceTemplates.forEach(function (x, i) { if (x.name === base) idx = i; });
    var mode;
    if (idx >= 0) {
      t.tplId = state.deviceTemplates[idx].tplId || ('tpl' + (state.seq++));
      if (state.deviceTemplates[idx].mixerDefaults) t.mixerDefaults = state.deviceTemplates[idx].mixerDefaults;
      state.deviceTemplates[idx] = t;
      mode = 'updated';
    } else {
      t.tplId = 'tpl' + (state.seq++);
      state.deviceTemplates.push(t);
      mode = 'added';
    }
    /* 同名系列设备统一挂到该模板 */
    state.devices.forEach(function (d) {
      if (baseNameOf(d.name) === base && d.type === dev.type) d.tplId = t.tplId;
    });
    save();
    return mode;
  }

  /* ---------- 模板库整体存档：设备模板 + 快速布局预设 + 台面模板 ---------- */

  function exportTemplateLib() {
    return {
      __signalpathTplLib: 1,
      deviceTemplates: JSON.parse(JSON.stringify(state.deviceTemplates)),
      quickPresets: JSON.parse(JSON.stringify(state.quickPresets || [])),
      reversePresets: JSON.parse(JSON.stringify(state.reversePresets || [])),
      userMixerTemplates: JSON.parse(JSON.stringify(state.userMixerTemplates || []))
    };
  }

  /* 设备模板按「类型+名称」合并去重：同名更新、新名追加。返回 'added' | 'updated' */
  function mergeTemplate(t) {
    if (!t || !t.name) return null;
    var idx = -1;
    state.deviceTemplates.forEach(function (x, i) {
      if (x.name === t.name && x.type === t.type) idx = i;
    });
    if (idx >= 0) {
      t.tplId = state.deviceTemplates[idx].tplId || ('tpl' + (state.seq++));
      state.deviceTemplates[idx] = t;
      return 'updated';
    }
    var dup = state.deviceTemplates.some(function (x) { return x.tplId && x.tplId === t.tplId; });
    if (!t.tplId || dup) t.tplId = 'tpl' + (state.seq++);
    state.deviceTemplates.push(t);
    return 'added';
  }

  /* opt.replace = true：先清空当前模板库再导入（覆盖）；否则按名称查重合并 */
  function importTemplateLib(data, opt) {
    opt = opt || {};
    var res = { dev: 0, presets: 0, reversePresets: 0, mixerTpls: 0, replaced: !!opt.replace };
    batch(function () {
      if (opt.replace) {
        state.deviceTemplates = [];
        state.quickPresets = [];
        state.reversePresets = [];
        state.userMixerTemplates = [];
      }
      (data.deviceTemplates || []).forEach(function (t) {
        if (mergeTemplate(JSON.parse(JSON.stringify(t)))) res.dev++;
      });
      state.quickPresets = state.quickPresets || [];
      (data.quickPresets || []).forEach(function (p) {
        if (!p || !p.name) return;
        var i = -1;
        state.quickPresets.forEach(function (x, j) { if (x.name === p.name) i = j; });
        if (i >= 0) state.quickPresets[i] = p; else state.quickPresets.push(p);
        res.presets++;
      });
      state.reversePresets = state.reversePresets || [];
      (data.reversePresets || []).forEach(function (p) {
        if (!p || !p.name) return;
        var ri = -1;
        state.reversePresets.forEach(function (x, j) { if (x.name === p.name) ri = j; });
        if (ri >= 0) state.reversePresets[ri] = p; else state.reversePresets.push(p);
        res.reversePresets++;
      });
      state.userMixerTemplates = state.userMixerTemplates || [];
      (data.userMixerTemplates || []).forEach(function (m) {
        if (!m || !m.name) return;
        var i2 = -1;
        state.userMixerTemplates.forEach(function (x, j) { if (x.name === m.name) i2 = j; });
        if (i2 >= 0) state.userMixerTemplates[i2] = m; else state.userMixerTemplates.push(m);
        res.mixerTpls++;
      });
    });
    return res;
  }

  /* 一键模板：把画布上所有设备按名称系列归类存入模板库 */
  function saveAllTemplates() {
    var seen = {};
    var added = 0, updated = 0;
    batch(function () {
      state.devices.forEach(function (d) {
        var base = baseNameOf(d.name) || d.name;
        var key = d.type + '::' + base;
        if (seen[key]) return;
        seen[key] = true;
        if (saveDeviceAsTemplate(d) === 'added') added++; else updated++;
      });
    });
    return { added: added, updated: updated };
  }

  function clearDeviceConnections(id, side) {
    var before = state.connections.length;
    side = side || 'all';
    state.connections = state.connections.filter(function (c) {
      if (side === 'inputs') return c.tid !== id;
      if (side === 'outputs') return c.sid !== id;
      return c.sid !== id && c.tid !== id;
    });
    if (state.connections.length !== before) save();
    return before - state.connections.length;
  }

  function moveDevice(id, dir) {
    var i = state.devices.findIndex(function (d) { return d.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= state.devices.length) return;
    var t = state.devices[i];
    state.devices[i] = state.devices[j];
    state.devices[j] = t;
    save();
  }

  /* ---------- 批量复制设备（自动编号命名） ---------- */

  function cloneDevice(id, count) {
    var dev = getDevice(id);
    if (!dev || count < 1) return 0;
    var m = dev.name.match(/^(.*?)\s*(\d+)号$/);
    var base = m ? m[1] : dev.name;
    var maxN = 1;
    state.devices.forEach(function (d) {
      var mm = d.name.match(/^(.*?)\s*(\d+)号$/);
      if (mm && mm[1] === base) maxN = Math.max(maxN, +mm[2]);
      else if (d.name === base) maxN = Math.max(maxN, 1);
    });
    var at = state.devices.indexOf(dev);
    for (var k = 1; k <= count; k++) {
      var copy = JSON.parse(JSON.stringify(dev));
      copy.id = uid();
      copy.name = base + ' ' + (maxN + k) + '号';
      delete copy.px; delete copy.py;      /* 副本回到自动排版位置 */
      state.devices.splice(at + k, 0, copy);
    }
    save();
    return count;
  }

  /* ---------- 批量添加命名：返回 base 1号 / 2号…（接续已有编号） ---------- */

  function numberedNames(base, count) {
    var m = base.match(/^(.*?)\s*(\d+)号$/);
    if (m) base = m[1];
    var maxN = 0;
    state.devices.forEach(function (d) {
      var mm = d.name.match(/^(.*?)\s*(\d+)号$/);
      if (mm && mm[1] === base) maxN = Math.max(maxN, +mm[2]);
      else if (d.name === base) maxN = Math.max(maxN, 1);
    });
    var names = [];
    for (var k = 1; k <= count; k++) names.push(base + ' ' + (maxN + k) + '号');
    return names;
  }

  /* ---------- 智能分配：为该设备的未接输入按序接入上游空闲输出 ---------- */

  function autoSourceTypes(dev) {
    if (dev.type === 'switch') return [];   /* 交换机走网口线，不参与音频智连 */
    if (dev.type === 'dsp') return ['mixer'];
    if (dev.type === 'amp') return ['dsp', 'mixer'];
    /* 智能连接默认不自动并联：音箱只自动接功放/线路口，多余音箱提示未接。
       手动音箱→音箱并联仍然允许（见 canAutoConnect 的 manual 分支 / connectionError）。 */
    if (dev.type === 'speaker') return speakerPowered(dev) ? ['dsp', 'mixer'] : ['amp'];
    if (dev.type === 'mixer') return [];
    return ['mixer', 'dsp'];   /* 自定义类型只自动接线路级上游，避免误接功放输出 */
  }

  function canAutoConnect(target, source) {
    if (!target || !source || target.id === source.id) return false;
    if (target.type === 'switch' || source.type === 'switch') return false;
    if (target.type === 'speaker') {
      /* 音箱 → 音箱 并联仅限手动连线（智能分配不会走到这里，autoSourceTypes 已排除） */
      if (source.type === 'speaker') {
        return speakerPowered(source) === speakerPowered(target) &&
          (source.speakerRole || 'fullrange') === (target.speakerRole || 'fullrange');
      }
      if (speakerPowered(target)) {
        return signalOf(source, 'out') === 'line';
      }
      return source.type === 'amp' && signalOf(source, 'out') === 'speaker';
    }
    if (signalOf(source, 'out') !== signalOf(target, 'in')) return false;
    if (target.type === 'amp') return source.type === 'dsp' || source.type === 'mixer';
    if (target.type === 'dsp') return source.type === 'mixer';
    if (target.type === 'mixer') return false;
    return source.type !== 'amp' && source.type !== 'speaker';
  }

  function autoFreeOuts(dev) {
    var pref = autoSourceTypes(dev), outs = [];
    /* 反推行绑定：带 reverseParallel.row 的音响，只从同行功放取口（若该行功放仍在），
       保证清线后再智连时功放-音响功率匹配不被打乱 */
    var rowId = dev.type === 'speaker' && dev.reverseParallel ? dev.reverseParallel.row : 0;
    var rowAmpExists = !!rowId && state.devices.some(function (s) {
      return s.type === 'amp' && s.reverseRow === rowId;
    });
    for (var pi = 0; pi < pref.length; pi++) {
      var tk = pref[pi];
      state.devices.forEach(function (s) {
        if (s.type !== tk || !canAutoConnect(dev, s)) return;
        if (tk === 'amp' && rowAmpExists && s.reverseRow !== rowId) return;
        s.outputs.forEach(function (p, i) {
          if (isHiddenOut(s, i)) return;
          if (!consumersOf(s.id, i).length) outs.push({ dev: s, port: i });
        });
      });
      if (outs.length) break;
    }
    return outs;
  }

  /* 设备所属的反推并联锁定组（按 index 排序）；非锁定组返回 null */
  function parallelGroupOf(dev) {
    var rp = dev && dev.type === 'speaker' && dev.reverseParallel && dev.reverseParallel.locked
      ? dev.reverseParallel : null;
    if (!rp || !rp.groupId) return null;
    return state.devices.filter(function (d) {
      return d.type === 'speaker' && d.reverseParallel && d.reverseParallel.groupId === rp.groupId;
    }).sort(function (a, b) {
      return ((a.reverseParallel || {}).index || 1) - ((b.reverseParallel || {}).index || 1);
    });
  }

  /* 单设备智能分配（与一键智能连接同款规则，但只动这台设备 / 它所在并联组）。
     · 尊重功放匹配（autoFreeOuts 的 reverseRow 行绑定）
     · 属于并联锁定组：接顺整组（组长接同行功放、从属串接组长）——组是一个逻辑整体
     · 严格不影响其他链路 */
  function smartAssign(id) {
    var dev = getDevice(id);
    if (!dev) return { lines: [], msg: '' };
    if (dev.type === 'switch') {
      return { lines: [], msg: '交换机通过网口线连接调音台（右键设备 → 网口线），不参与音频智能连接。' };
    }

    /* 并联锁定组：把这一组接顺 */
    var group = parallelGroupOf(dev);
    if (group && group.length) {
      var leader = group[0];
      var lines0 = [];
      if (!sourceFor(leader.id, 0)) {
        var outs0 = autoFreeOuts(leader);
        if (outs0.length) {
          var o0 = outs0[0];
          var r0 = connect(leader.id, 0, o0.dev.id, o0.port);
          if (!(r0 && r0.ok === false)) {
            lines0.push(o0.dev.name + ' · ' + o0.dev.outputs[o0.port].label + ' → ' + leader.name);
          }
        }
      }
      var chained = chainLockedGroup(group);
      if (chained) lines0.push('并联串接 ' + chained + ' 条（' + leader.name + ' 组）');
      if (!lines0.length) {
        return { lines: [], msg: sourceFor(leader.id, 0)
          ? '该并联组已接好。'
          : '并联组组长没有可用的功放空闲输出（可手动增加/更换功放）。' };
      }
      return { lines: lines0, msg: '' };
    }

    var freeInputs = [];
    dev.inputs.forEach(function (p, i) {
      if (!sourceFor(dev.id, i)) freeInputs.push(i);
    });
    if (!freeInputs.length) {
      return { lines: [], msg: '「' + dev.name + '」的所有输入口都已连接。' };
    }

    var freeOuts = autoFreeOuts(dev);
    if (!freeOuts.length) {
      return { lines: [], msg: dev.type === 'mixer'
        ? '调音台通常是信号源，没有可自动接入的上游输出。'
        : dev.type === 'speaker'
          ? (speakerPowered(dev)
            ? '有源音箱只自动接调音台 / DSP 信号线输出；当前没有可用空闲输出（可手动并联）。'
            : '无源音箱只自动接功放音响线输出；当前没有可用空闲输出（可手动并联）。')
          : '上游设备没有可安全自动分配的空闲输出口。' };
    }

    var n = Math.min(freeInputs.length, freeOuts.length);
    var lines = [];
    for (var k = 0; k < n; k++) {
      var o = freeOuts[k], ti = freeInputs[k];
      var r = connect(dev.id, ti, o.dev.id, o.port);
      if (r && r.ok === false) continue;
      lines.push(o.dev.name + ' · ' + o.dev.outputs[o.port].label +
        ' → ' + dev.inputs[ti].label);
    }
    /* 普通音箱若是某并联组组长，顺带把从属串接好（逻辑整体） */
    if (dev.type === 'speaker') {
      var g2 = parallelGroupOf(dev);
      if (g2 && g2[0] && g2[0].id === dev.id) {
        var c2 = chainLockedGroup(g2);
        if (c2) lines.push('并联串接 ' + c2 + ' 条');
      }
    }
    return { lines: lines, msg: '' };
  }

  /* 一键智能连接：按信号层级（DSP → 功放 → 音箱）依次给所有未接输入补线，
     保证上游先接好、下游再级联；同层内按机架顺序。 */
  function smartAssignAll() {
    var roleOrd = { linearray: 0, fullrange: 1, sub: 2 };
    function layerOf(d) {
      if (d.type === 'mixer') return -1;   /* 信号源，不参与 */
      if (d.type === 'switch') return -1;  /* 交换机走网口线，不参与音频智连 */
      if (d.type === 'dsp') return 1;
      if (d.type === 'amp') return 2;
      if (d.type === 'speaker') return 3 + (roleOrd[d.speakerRole || 'fullrange'] || 1) / 10;
      return 1.5;   /* 自定义类型 */
    }
    var order = state.devices
      .map(function (d, i) { return { d: d, i: i, l: layerOf(d) }; })
      .filter(function (x) {
        if (x.l < 0) return false;
        /* 锁定并联组的从属音箱不抢功放口（由 enforceReverseParallelGroups 串回组长），
           避免占用端口饿死其他组长 */
        var rp = x.d.reverseParallel;
        if (rp && rp.locked && rp.index > 1) return false;
        return true;
      })
      .sort(function (a, b) { return a.l - b.l || a.i - b.i; });

    var lines = [];
    var count = 0;
    order.forEach(function (x) {
      var r = smartAssign(x.d.id);
      if (r.lines.length) {
        lines.push('— ' + x.d.name + '：');
        r.lines.forEach(function (l) { lines.push('　' + l); });
        count += r.lines.length;
      }
    });
    var lockedN = enforceReverseParallelGroups();
    if (lockedN) {
      lines.push('— 反推并联串接：');
      lines.push('　已恢复 ' + lockedN + ' 条受控并联串接线');
      count += lockedN;
    }
    /* Dante：有交换机时，把还没上网的调音台按顺序接到交换机网口 1、2、3… */
    var sw0 = state.devices.filter(function (d) { return d.type === 'switch'; })[0];
    if (sw0) {
      var netN = 0;
      state.devices.forEach(function (d) {
        if (d.type !== 'mixer' || netLinkBetween(d.id, sw0.id)) return;
        var r = addNetLink(d.id, sw0.id);
        if (r.ok) netN++;
      });
      if (netN) {
        lines.push('— Dante 网口：');
        lines.push('　已把 ' + netN + ' 台调音台接到「' + sw0.name + '」网口');
        count += netN;
      }
    }
    /* 仍未接的输入口（不含调音台的话筒/线路输入）；音响单独统计只数用于提示 */
    var remaining = 0;
    var speakerLeft = 0;
    state.devices.forEach(function (d) {
      if (d.type === 'mixer' || d.type === 'switch') return;
      var unfed = false;
      d.inputs.forEach(function (pt, i) {
        if (!sourceFor(d.id, i)) { remaining++; unfed = true; }
      });
      if (unfed && d.type === 'speaker') speakerLeft++;
    });
    return { lines: lines, count: count, remaining: remaining, speakerLeft: speakerLeft };
  }

  /* 一键清空全部连线（可通过撤销恢复） */
  function clearAllConnections() {
    var n = state.connections.length;
    if (n) {
      state.connections = [];
      save();
    }
    return n;
  }

  function smartAssignPreview(id) {
    var dev = getDevice(id);
    if (!dev) return { count: 0, msg: '' };
    /* 并联锁定组：预览待接顺的连线数（组长缺功放 + 未正确串接的从属） */
    var group = parallelGroupOf(dev);
    if (group && group.length) {
      var leader = group[0];
      var need = (!sourceFor(leader.id, 0) && autoFreeOuts(leader).length) ? 1 : 0;
      for (var gi = 1; gi < group.length; gi++) {
        var c = sourceFor(group[gi].id, 0);
        if (!c || c.sid !== group[gi - 1].id) need++;
      }
      return { count: need, inputs: need, outputs: need, group: true };
    }
    var freeInputs = [];
    dev.inputs.forEach(function (p, i) {
      if (!sourceFor(dev.id, i)) freeInputs.push(i);
    });
    if (!freeInputs.length) return { count: 0, msg: '所有输入口都已连接。' };
    var freeOuts = autoFreeOuts(dev);
    return { count: Math.min(freeInputs.length, freeOuts.length), inputs: freeInputs.length, outputs: freeOuts.length };
  }

  /* ---------- 型号模板管理 ---------- */

  function addDeviceTemplate(t) {
    if (!t.tplId) t.tplId = 'tpl' + (state.seq++);
    state.deviceTemplates.push(t);
    save();
  }
  function updateDeviceTemplate(idx, t) {
    if (!state.deviceTemplates[idx]) return;
    t.tplId = state.deviceTemplates[idx].tplId || ('tpl' + (state.seq++));
    state.deviceTemplates[idx] = t;
    save();
  }
  function removeDeviceTemplate(idx) { state.deviceTemplates.splice(idx, 1); save(); }

  /* 模板 → 实例同步：同步路数/端口标注/规格(U数等)/颜色，不改实例名字 */
  function templateInstances(tplId) {
    if (!tplId) return [];
    return state.devices.filter(function (d) { return d.tplId === tplId; });
  }

  function syncTemplateInstances(idx) {
    var t = state.deviceTemplates[idx];
    if (!t || !t.tplId) return 0;
    var list = templateInstances(t.tplId);
    if (!list.length) return 0;
    var outs0 = Array.isArray(t.outs) ? t.outs.length : t.outs;
    batch(function () {
      list.forEach(function (d) {
        resizeDevice(d, t.ins, outs0);
        if (Array.isArray(t.outs)) {
          t.outs.forEach(function (lb, i) { if (d.outputs[i]) d.outputs[i].label = lb; });
        }
        var keepPowered = d.type === 'speaker' && d.specs ? d.specs.powered : null;
        d.specs = Object.assign({}, d.specs, t.specs || {});
        if (keepPowered) d.specs.powered = keepPowered;   /* 有源/无源是实例自己的选择 */
        if (t.color) d.color = t.color;
        if (d.type === 'speaker' && t.speakerRole) d.speakerRole = t.speakerRole;
      });
      cleanupConnectionErrors();
    });
    return list.length;
  }

  /* ---------- 快速布局：批量建设备 + 一键智能连接 = 单个撤销步骤。
     item.parallel > 1 的音箱行：智能连接后自动把未接音箱串到已接音箱后
     （SpeakON 菊花链：功放 OUT → 音箱1 → 音箱2 …） ---------- */

  function chainParallelSpeakers(devs, par) {
    if (par <= 1) return;
    var keepLeaders = Math.ceil(devs.length / par);
    var kept = 0;
    devs.forEach(function (d) {
      var c = sourceFor(d.id, 0);
      var s = c && getDevice(c.sid);
      if (!s || s.type === 'speaker') return;
      kept++;
      if (kept > keepLeaders) disconnect(d.id, 0, true);
    });
    function fed(d) {
      return d.inputs.some(function (p, i) { return !!sourceFor(d.id, i); });
    }
    var leaders = devs.filter(fed);
    var followers = devs.filter(function (d) { return !fed(d); });
    var fi = 0;
    leaders.forEach(function (lead) {
      var prev = lead;
      for (var k = 1; k < par && fi < followers.length; k++) {
        var next = followers[fi++];
        var r = connect(next.id, 0, prev.id, 0);
        if (r && r.ok === false) break;
        prev = next;
      }
    });
  }

  function makeDevicesFromTemplate(t, count, opt) {
    opt = opt || {};
    var out = [];
    if (!t || !count) return out;
    var outs0 = Array.isArray(t.outs) ? t.outs.length : t.outs;
    var names = count > 1 ? numberedNames(t.name, count) : [t.name];
    names.forEach(function (nm) {
      var specs = Object.assign({}, t.specs || {});
      if (t.type === 'speaker') specs.powered = opt.powered === 'active' ? 'active' : 'passive';
      var dev = makeDevice({
        type: t.type, name: nm, ins: t.ins, outs: outs0,
        outLabels: Array.isArray(t.outs) ? t.outs : null,
        speakerRole: t.type === 'speaker' ? (t.speakerRole || SP.inferSpeakerRole(t.name)) : '',
        specs: specs, mixerDefaults: t.mixerDefaults || null, tplId: t.tplId || ''
      });
      state.devices.push(dev);
      out.push(dev);
    });
    return out;
  }

  function freeLineOuts(devs) {
    var outs = [];
    (devs || []).forEach(function (d) {
      (d.outputs || []).forEach(function (p, i) {
        if (isHiddenOut(d, i)) return;
        if (!consumersOf(d.id, i).length) outs.push({ dev: d, port: i });
      });
    });
    return outs;
  }

  function connectSequential(sourceDevs, targets) {
    var outs = freeLineOuts(sourceDevs);
    var n = Math.min(outs.length, targets.length);
    for (var i = 0; i < n; i++) {
      connect(targets[i].dev.id, targets[i].port, outs[i].dev.id, outs[i].port);
    }
    return n;
  }

  function speakerGroups(devs, par, rowNo) {
    var groups = [];
    if (!devs.length) return groups;
    par = Math.max(1, +par || 1);
    for (var i = 0; i < devs.length; i += par) {
      var g = devs.slice(i, i + par);
      var groupId = 'rpg' + (state.seq++);
      g.forEach(function (d, j) {
        d.reverseParallel = {
          groupId: groupId, parallel: par, groupSize: g.length,
          index: j + 1, channel: groups.length + 1, row: rowNo || 0,
          locked: par > 1
        };
      });
      groups.push(g);
    }
    return groups;
  }

  function chainLockedGroup(group) {
    if (!group || !group.length) return 0;
    group.sort(function (a, b) {
      return ((a.reverseParallel || {}).index || 1) - ((b.reverseParallel || {}).index || 1);
    });
    var n = 0;
    for (var i = 1; i < group.length; i++) {
      disconnect(group[i].id, 0, true);
      var r = connect(group[i].id, 0, group[i - 1].id, 0);
      var c = sourceFor(group[i].id, 0);
      if (c) {
        c.reverseParallelGroupId = (group[i].reverseParallel || {}).groupId || '';
        c.reverseParallel = true;
      }
      if (!r || r.ok !== false) n++;
    }
    return n;
  }

  function enforceReverseParallelGroups() {
    var groups = {};
    state.devices.forEach(function (d) {
      if (d.type !== 'speaker' || !d.reverseParallel || !d.reverseParallel.locked) return;
      var gid = d.reverseParallel.groupId;
      if (!gid) return;
      (groups[gid] = groups[gid] || []).push(d);
    });
    var count = 0;
    Object.keys(groups).forEach(function (gid) {
      count += chainLockedGroup(groups[gid]);
    });
    return count;
  }

  function reverseLayout(plan) {
    plan = plan || {};
    var added = [];
    batch(function () {
      var mixers = makeDevicesFromTemplate(plan.mixerTpl, plan.mixerCount || 0);
      var dsps = makeDevicesFromTemplate(plan.dspTpl, plan.dspCount || 0);
      added = added.concat(mixers, dsps);

      var ampInputs = [];
      var rowPlans = [];
      (plan.speakerRows || []).forEach(function (row, ri) {
        var amps4 = makeDevicesFromTemplate(row.amp4Tpl || plan.amp4Tpl, row.a4 || 0);
        var amps2 = makeDevicesFromTemplate(row.amp2Tpl || plan.amp2Tpl, row.a2 || 0);
        var amps = amps4.concat(amps2);
        /* 功放绑定音响行：清线后智能连接按行回配，保证功放-音响功率匹配 */
        amps.forEach(function (amp) { amp.reverseRow = ri + 1; });
        var speakers = makeDevicesFromTemplate(row.tpl, row.count || 0, { powered: 'passive' });
        added = added.concat(amps, speakers);
        amps.forEach(function (amp) {
          (amp.inputs || []).forEach(function (p, i) { ampInputs.push({ dev: amp, port: i }); });
        });
        rowPlans.push({ row: row, amps: amps, speakers: speakers, groups: speakerGroups(speakers, row.parallel || 1, ri + 1) });
      });

      if (mixers.length && dsps.length) {
        var dspInputs = [];
        dsps.forEach(function (dsp) {
          (dsp.inputs || []).forEach(function (p, i) { dspInputs.push({ dev: dsp, port: i }); });
        });
        connectSequential(mixers, dspInputs);
      }
      connectSequential(dsps.length ? dsps : mixers, ampInputs);

      rowPlans.forEach(function (rp) {
        var ampOuts = [];
        rp.amps.forEach(function (amp) {
          visibleOuts(amp).forEach(function (oi) {
            if (!consumersOf(amp.id, oi).length) ampOuts.push({ dev: amp, port: oi });
          });
        });
        rp.groups.forEach(function (g, gi) {
          if (!g.length || !ampOuts[gi]) return;
          connect(g[0].id, 0, ampOuts[gi].dev.id, ampOuts[gi].port);
          chainLockedGroup(g);
        });
      });

      /* 有源音箱：不参与功放反推，直接创建并从空闲的 DSP/调音台线路输出接入 */
      var activeSpeakers = [];
      (plan.activeRows || []).forEach(function (row) {
        var spk = makeDevicesFromTemplate(row.tpl, row.count || 0, { powered: 'active' });
        added = added.concat(spk);
        activeSpeakers = activeSpeakers.concat(spk);
      });
      if (activeSpeakers.length) {
        var lineOuts = [];
        (dsps.length ? dsps : mixers).forEach(function (src) {
          visibleOuts(src).forEach(function (oi) {
            if (!consumersOf(src.id, oi).length) lineOuts.push({ dev: src, port: oi });
          });
        });
        var ai = 0;
        activeSpeakers.forEach(function (spk) {
          if (ai < lineOuts.length) {
            connect(spk.id, 0, lineOuts[ai].dev.id, lineOuts[ai].port);
            ai++;
          }
        });
      }
      state.diagramLayout = 'bottomup';   /* 默认对齐（按功放分组的上级对齐下级） */
    });
    return added;
  }

  function quickLayout(items) {
    var added = [];
    var perItem = [];
    batch(function () {
      (items || []).forEach(function (it) {
        var mine = [];
        perItem.push(mine);
        if (!it.tpl || !it.count) return;
        var t = it.tpl;
        var outs0 = Array.isArray(t.outs) ? t.outs.length : t.outs;
        var names = it.count > 1 ? numberedNames(t.name, it.count) : [t.name];
        names.forEach(function (nm) {
          var specs = Object.assign({}, t.specs || {});
          if (t.type === 'speaker') {
            specs.powered = it.powered === 'active' ? 'active' : 'passive';
          }
          var dev = makeDevice({
            type: t.type, name: nm, ins: t.ins, outs: outs0,
            outLabels: Array.isArray(t.outs) ? t.outs : null,
            speakerRole: t.type === 'speaker' ? (t.speakerRole || SP.inferSpeakerRole(t.name)) : '',
            specs: specs, mixerDefaults: t.mixerDefaults || null, tplId: t.tplId || ''
          });
          state.devices.push(dev);
          added.push(dev);
          mine.push(dev);
        });
      });
      if (added.length) {
        smartAssignAll();
        (items || []).forEach(function (it, idx) {
          if (it.tpl && it.tpl.type === 'speaker' && (it.parallel || 1) > 1) {
            chainParallelSpeakers(perItem[idx], it.parallel);
          }
        });
        state.diagramLayout = 'bottomup';   /* 默认对齐（按功放分组的上级对齐下级） */
      }
    });
    return added;
  }

  /* ---------- 音响反推（纯函数，可测）----------
     rows: [{ name, power(W), ohms(Ω), count, parallel(每通道并联只数,默认1) }]
     opt:  { ratio, ampMode:'2'|'4'|'mix', amp2W, amp4W, minOhms(4|2), dspOuts, mixerN }
     规则：不同型号音响不混用同一台功放；搭配模式 4 通道优先，
     余 ≤2 路补 1 台 2 通道，余 3 路补 1 台 4 通道；全部向上取整保富余。 */
  function reverseCalc(rows, opt) {
    opt = opt || {};
    var ratio = +opt.ratio || 1.5;
    var minOhms = +opt.minOhms || 4;
    var res = { rows: [], amp2N: 0, amp4N: 0, dspN: 0, ampInputs: 0,
      warns: [], errors: [], channels: 0, totalNeedW: 0, totalLoadW: 0, totalSpeakerW: 0 };
    (rows || []).forEach(function (r) {
      var count = Math.max(0, +r.count || 0);
      if (!count) return;
      var par = Math.max(1, +r.parallel || 1);
      var w = +r.power || 0;
      var ohm = +r.ohms || 0;
      var label = r.name || '未命名音响';
      if (!w) { res.errors.push(label + '：缺功率，无法反推'); return; }
      if (par > 1 && !ohm) { res.errors.push(label + '：并联必须填写阻抗'); return; }
      var loadW = w * par;                       /* 并联功率叠加 */
      var baseOhm = ohm || 8;                    /* 单只未填阻抗按 8Ω 标准箱计算 */
      var loadOhm = Math.round(baseOhm / par * 100) / 100;   /* 并联阻抗减半 */
      var rowRatio = +r.ratio || (((r.role || r.speakerRole) === 'sub') ? (+opt.subRatio || 2) : ratio);
      var needLoadW = Math.ceil(loadW * rowRatio);  /* 实际负载侧功率（含余量） */
      var ch = Math.ceil(count / par);
      /* 反推先把当前负载折算回 8Ω 标称口径，再乘余量：
         单只功率 × 并联数量 ÷ 当前负载倍率 × 余量倍率。 */
      var factor = ampImpedanceFactor(loadOhm);
      var needRatedW = Math.ceil(loadW / factor * rowRatio);
      var needW = needRatedW;
      if (loadOhm && loadOhm < minOhms) {
        res.warns.push('⚠ ' + label + '：并联后 ' + loadOhm + 'Ω 低于功放最低负载 ' +
          minOhms + 'Ω' + (minOhms === 4 ? '（可切换 2Ω 低阻机型）' : ''));
      }
      var a2 = 0, a4 = 0;
      if (opt.ampMode === '2') {
        a2 = Math.ceil(ch / 2);
      } else if (opt.ampMode === '4') {
        a4 = Math.ceil(ch / 4);
      } else {
        /* 搭配模式：先看功率是否合适；都合适或都不合适时优先 4 通道，只有
           4 通道不够而 2 通道够时才回退到 2 通道。 */
        function ampFits(rated8, rated4) {
          if (!rated8 && !rated4) return false;
          return ampRatedEquivalentPower({ power: rated8, power4: rated4 }, loadOhm) >= needRatedW;
        }
        var fit4 = ampFits(opt.amp4W, opt.amp4W4);
        var fit2 = ampFits(opt.amp2W, opt.amp2W4);
        if (fit4 || !fit2) a4 = Math.ceil(ch / 4);
        else a2 = Math.ceil(ch / 2);
      }
      function ohmNote() {
        return loadOhm && loadOhm !== 8 ? '（' + loadOhm + 'Ω 负载折算）' : '';
      }
      function ampEquiv(rated8, rated4) {
        return ampRatedEquivalentPower({ power: rated8, power4: rated4 }, loadOhm);
      }
      function ampPickedNote(rated8, rated4) {
        var r4 = powerNumber(rated4);
        var equiv = ampEquiv(rated8, rated4);
        if (r4 && loadOhm && loadOhm < 8 && loadOhm >= 4) {
          return '，所选 4Ω 实标 ' + r4 + 'W（折算 @8Ω ' + equiv + 'W）';
        }
        return '，所选 8Ω 标称 ' + powerNumber(rated8) + 'W' + ohmNote();
      }
      /* 比较所选功放折算 @8Ω 后的功率与 needRatedW（4Ω实填优先折算）。 */
      if (a2 && (opt.amp2W || opt.amp2W4) && ampEquiv(opt.amp2W, opt.amp2W4) < needRatedW) {
        res.warns.push('⚠ 2通道功放功率不足：' + label + ' 需 8Ω标称 ≥' + needRatedW +
          'W' + ampPickedNote(opt.amp2W, opt.amp2W4));
      }
      if (a4 && (opt.amp4W || opt.amp4W4) && ampEquiv(opt.amp4W, opt.amp4W4) < needRatedW) {
        res.warns.push('⚠ 4通道功放功率不足：' + label + ' 需 8Ω标称 ≥' + needRatedW +
          'W' + ampPickedNote(opt.amp4W, opt.amp4W4));
      }
      res.amp2N += a2;
      res.amp4N += a4;
      res.channels += ch;
      res.totalNeedW += needRatedW * ch;
      res.totalLoadW += needLoadW * ch;
      res.totalSpeakerW += w * count;
      res.rows.push({ name: label, needW: needW, needRatedW: needRatedW, ch: ch,
        needLoadW: needLoadW, loadW: loadW, loadOhm: loadOhm, factor: factor,
        ohmScale: 1 / factor, ratio: rowRatio, role: r.role || r.speakerRole || '',
        par: par, count: count, a2: a2, a4: a4 });
    });
    res.ampInputs = res.amp2N * 2 + res.amp4N * 4;
    /* 有源音响不参与功放反推，但占用 DSP（或调音台）线路输出通道 */
    res.activeCount = Math.max(0, +opt.activeCount || 0);
    res.lineFeeds = res.ampInputs + res.activeCount;
    /* dspOuts 显式为 0 = 无 DSP 直推（不建 DSP）；省略时按默认 8 假设有 DSP（向后兼容） */
    var dspOuts = (opt.dspOuts === 0 || opt.dspOuts === '0') ? 0 : (+opt.dspOuts || 8);
    res.dspN = (res.lineFeeds && dspOuts > 0) ? Math.ceil(res.lineFeeds / dspOuts) : 0;
    /* 调音台需喂出的输出路数：有 DSP 时喂满全部 DSP 输入（dspN × dspIns）；
       无 DSP 时直推功放输入 + 有源。用于「调音台输出不足」提示（只提示、不自动加） */
    res.dspInputs = res.dspN * Math.max(1, +opt.dspIns || 0);
    res.mixerFeeds = res.dspN ? res.dspInputs : res.lineFeeds;
    return res;
  }

  function resizeDevice(dev, ins, outs) {
    var isAmp = dev.type === 'amp';
    while (dev.inputs.length < ins) dev.inputs.push({ label: 'IN ' + (dev.inputs.length + 1) });
    while (dev.inputs.length > ins) dev.inputs.pop();
    while (dev.outputs.length < outs) {
      var p = { label: 'OUT ' + (dev.outputs.length + 1) };
      if (isAmp) p.gain = '';
      dev.outputs.push(p);
    }
    while (dev.outputs.length > outs) dev.outputs.pop();
    if (isAmp) {
      if (!dev.specs) dev.specs = {};
      if (dev.specs.grounded === undefined) dev.specs.grounded = true;
      var pairs = Math.ceil(dev.outputs.length / 2);
      if (!Array.isArray(dev.ampPairModes)) dev.ampPairModes = [];
      while (dev.ampPairModes.length < pairs) dev.ampPairModes.push('S');
      dev.ampPairModes.length = pairs;
    }
    if (dev.type === 'dsp') ensureDspRoute(dev);
    state.connections = state.connections.filter(function (c) {
      var s = getDevice(c.sid), t = getDevice(c.tid);
      return s && t && c.sport < s.outputs.length && c.tport < t.inputs.length;
    });
    save();
  }

  /* ---------- 功放输出对模式（P 并联 / S 立体声 / B 桥接） ---------- */

  function ampPairMode(dev, pair) {
    return (dev.ampPairModes && dev.ampPairModes[pair]) || 'P';
  }

  /* 选 B 桥接：该对的奇数端口并入偶数端口，其上连线自动断开（可撤销） */
  function setAmpPairMode(devId, pair, mode) {
    var dev = getDevice(devId);
    if (!dev || dev.type !== 'amp') return;
    if (!Array.isArray(dev.ampPairModes)) dev.ampPairModes = [];
    dev.ampPairModes[pair] = mode === 'B' ? 'B' : mode === 'S' ? 'S' : 'P';
    if (mode === 'B') {
      var hidden = pair * 2 + 1;
      state.connections = state.connections.filter(function (c) {
        return !(c.sid === dev.id && c.sport === hidden);
      });
    }
    save();
  }

  /* 桥接对的奇数端口在框图/连接中隐藏 */
  function isHiddenOut(dev, i) {
    return !!dev && dev.type === 'amp' && i % 2 === 1 && ampPairMode(dev, (i - 1) / 2) === 'B';
  }

  function visibleOuts(dev) {
    var arr = [];
    (dev.outputs || []).forEach(function (p, i) {
      if (!isHiddenOut(dev, i)) arr.push(i);
    });
    return arr;
  }

  function outLabelOf(dev, i) {
    if (i < 0) return '网口';   /* 网口线源端不占音频输出口 */
    var p = dev.outputs[i];
    if (!p) return '';
    if (dev.type === 'amp' && i % 2 === 0 && ampPairMode(dev, i / 2) === 'B') {
      return p.label + ' (BTL桥接)';
    }
    return p.label;
  }

  /* ---------- 端口接口类型（可按口覆盖默认值） ---------- */

  function portConn(dev, side, i) {
    var p = side === 'in' ? dev.inputs[i] : dev.outputs[i];
    return (p && p.conn) || SP.defaultConn(dev, side);
  }
  function setPortConn(devId, side, i, conn) {
    var dev = getDevice(devId);
    if (!dev) return;
    var p = side === 'in' ? dev.inputs[i] : dev.outputs[i];
    if (!p) return;
    if (conn && conn !== SP.defaultConn(dev, side)) p.conn = conn;
    else delete p.conn;
    save();
  }

  /* ---------- 信号类型（用于类型一致性警示 / 线材默认值） ---------- */

  function speakerPowered(dev) {
    return !!(dev && dev.type === 'speaker' && dev.specs && dev.specs.powered === 'active');
  }

  function signalOf(dev, dir) {
    if (dev.type === 'amp' && dir === 'out') return 'speaker';
    if (dev.type === 'speaker') return speakerPowered(dev) ? 'line' : 'speaker';
    return 'line';
  }
  function signalName(sig) { return sig === 'speaker' ? '喇叭级' : '线路级'; }

  /* ---------- 连接（以输入口为主键：一个输入只允许一个来源） ---------- */

  function sourceFor(tid, tport) {
    for (var i = 0; i < state.connections.length; i++) {
      var c = state.connections[i];
      if (c.tid === tid && c.tport === tport) return c;
    }
    return null;
  }

  function consumersOf(sid, sport) {
    return state.connections.filter(function (c) {
      return c.sid === sid && c.sport === sport;
    });
  }

  function connect(tid, tport, sid, sport) {
    /* 1:1 规则：输入口只有一个来源，输出口也只接一个目标 —
       新连接会同时替换掉该输入口的旧来源和该输出口的旧去向 */
    var srcDev = getDevice(sid);
    if (srcDev && isHiddenOut(srcDev, sport)) {
      return { ok: false, msg: '该输出口处于 BTL 桥接模式，已并入相邻端口，不能单独连线。' };
    }
    var next = { tid: tid, tport: tport, sid: sid, sport: sport, cable: '', color: '', lenM: '', note: '' };
    var error = connectionError(next);
    if (error) {
      state.connections = state.connections.filter(function (c) {
        return !(c.tid === tid && c.tport === tport);
      });
      save();
      return { ok: false, msg: error };
    }
    state.connections = state.connections.filter(function (c) {
      return !(c.tid === tid && c.tport === tport) &&
             !(c.sid === sid && c.sport === sport);
    });
    state.connections.push(next);
    save();
    return { ok: true, msg: connWarning(next) || '' };
  }

  function disconnect(tid, tport, noSave) {
    state.connections = state.connections.filter(function (c) {
      return !(c.tid === tid && c.tport === tport && !c.net);
    });
    if (!noSave) save();
  }

  /* ---------- 网口线（Dante 数字层）----------
     与音频连线共用 connections 存储，c.net = true 标记。
     · 不占音频端口：源端 sport = -1；交换机端占用真实网口（tport）
     · 调音台 ↔ 调音台直连时 tport 也为 -1
     · 不参与信号层级 / 智能连接 / 功率计算 */
  function isNetConn(c) { return !!(c && c.net); }

  function netLinksOf(id) {
    return state.connections.filter(function (c) {
      return c.net && (c.sid === id || c.tid === id);
    });
  }

  function netLinkBetween(aid, bid) {
    for (var i = 0; i < state.connections.length; i++) {
      var c = state.connections[i];
      if (!c.net) continue;
      if ((c.sid === aid && c.tid === bid) || (c.sid === bid && c.tid === aid)) return c;
    }
    return null;
  }

  /* 自定义交换机网口数量（1~64）。缩减时断开落在被删网口上的网口线。 */
  function setSwitchPorts(devId, n) {
    var d = getDevice(devId);
    if (!d || d.type !== 'switch') return { ok: false, msg: '仅交换机可设置网口数。' };
    n = Math.max(1, Math.min(64, Math.floor(+n) || 1));
    var old = d.inputs.length;
    if (n === old) return { ok: true };
    if (n > old) {
      for (var i = old; i < n; i++) d.inputs.push({ label: '网口 ' + (i + 1) });
    } else {
      /* 断开落在将被删除网口（index >= n）上的网口线 */
      state.connections = state.connections.filter(function (c) {
        return !(c.net && c.tid === devId && c.tport >= n);
      });
      d.inputs = d.inputs.slice(0, n);
    }
    save();
    return { ok: true };
  }

  /* 交换机上第一个空闲网口；没有返回 -1 */
  function freeNetPort(sw) {
    for (var i = 0; i < (sw.inputs || []).length; i++) {
      var used = state.connections.some(function (c) {
        return c.net && c.tid === sw.id && c.tport === i;
      });
      if (!used) return i;
    }
    return -1;
  }

  function addNetLink(aid, bid) {
    var a = getDevice(aid), b = getDevice(bid);
    if (!a || !b || aid === bid) return { ok: false, msg: '设备无效。' };
    function netOK(d) { return d.type === 'mixer' || d.type === 'switch'; }
    if (!netOK(a) || !netOK(b)) return { ok: false, msg: '网口线只用于调音台与交换机之间。' };
    if (a.type === 'switch' && b.type === 'switch') {
      return { ok: false, msg: '暂不支持交换机级联，请把调音台分别接到同一台交换机。' };
    }
    if (netLinkBetween(aid, bid)) return { ok: false, msg: '两台设备之间已有网口线。' };
    var c;
    if (a.type === 'switch' || b.type === 'switch') {
      var sw = a.type === 'switch' ? a : b;
      var mx = a.type === 'switch' ? b : a;
      var port = freeNetPort(sw);
      if (port < 0) return { ok: false, msg: '「' + sw.name + '」的网口已用完。' };
      /* 接入交换机 = 走集中式 Dante：自动清掉该调音台原有的「调音台↔调音台」直连，
         避免"既直连又走交换机"的矛盾（用户确认：有交换机就只连交换机） */
      state.connections = state.connections.filter(function (x) {
        if (!x.net) return true;
        var s = getDevice(x.sid), t = getDevice(x.tid);
        var involvesMx = x.sid === mx.id || x.tid === mx.id;
        var bothMixer = s && t && s.type === 'mixer' && t.type === 'mixer';
        return !(involvesMx && bothMixer);
      });
      c = { sid: mx.id, sport: -1, tid: sw.id, tport: port,
        net: true, cable: '网线(Dante)', color: '', lenM: '', note: '' };
    } else {
      /* 调音台 ↔ 调音台 直连（小系统无交换机）。
         若任一台已接入交换机，则不允许再直连（有交换机就只走交换机） */
      function onSwitch(id) {
        return state.connections.some(function (x) {
          if (!x.net) return false;
          var o = getDevice(x.sid === id ? x.tid : x.sid);
          return (x.sid === id || x.tid === id) && o && o.type === 'switch';
        });
      }
      if (onSwitch(aid) || onSwitch(bid)) {
        return { ok: false, msg: '已接入交换机的调音台走集中式 Dante，请在交换机上互联，不再直连。' };
      }
      /* tport 用未占用的负数，保证 (tid,tport) 键全局唯一（线材表按键定位） */
      var np = -1;
      while (state.connections.some(function (x) {
        return x.tid === bid && x.tport === np;
      })) np--;
      c = { sid: aid, sport: -1, tid: bid, tport: np,
        net: true, cable: '网线(Dante)', color: '', lenM: '', note: '' };
    }
    state.connections.push(c);
    save();
    return { ok: true, msg: '', conn: c };
  }

  /* ---------- 调音台 Dante 通道分配 ----------
     每台调音台可把任意物理输入/输出标记为「走 Dante」（支持整段拖选 / 全选），
     三个入口共用同一数据：设备详情页 / 右键菜单 / 台内路由页 / 框图聚合亮节点。 */
  function danteList(dev, side) {
    if (!dev || dev.type !== 'mixer') return [];
    var arr = side === 'in' ? dev.danteIn : dev.danteOut;
    return Array.isArray(arr) ? arr : [];
  }

  function isDante(dev, side, i) {
    return danteList(dev, side).indexOf(i) >= 0;
  }

  function toggleDante(devId, side, i) {
    var d = getDevice(devId);
    if (!d || d.type !== 'mixer') return { ok: false, msg: '仅调音台支持 Dante 分配。' };
    var key = side === 'in' ? 'danteIn' : 'danteOut';
    if (!Array.isArray(d[key])) d[key] = [];
    var idx = d[key].indexOf(i);
    if (idx >= 0) {
      d[key].splice(idx, 1);
    } else {
      d[key].push(i);
      d[key].sort(function (a, b) { return a - b; });
    }
    save();
    return { ok: true, on: idx < 0 };
  }

  /* 批量设置一段/整组 Dante 通道（拖拽框选 / 整行 / 全选 / 全不选共用）。
     ports: 端口下标数组；on: true=全设为 Dante，false=全取消 */
  function setDante(devId, side, ports, on) {
    var d = getDevice(devId);
    if (!d || d.type !== 'mixer') return { ok: false, msg: '仅调音台支持 Dante 分配。' };
    var key = side === 'in' ? 'danteIn' : 'danteOut';
    var max = side === 'in' ? d.inputs.length : d.outputs.length;
    var set = {};
    (Array.isArray(d[key]) ? d[key] : []).forEach(function (i) { set[i] = true; });
    (ports || []).forEach(function (i) {
      if (i < 0 || i >= max) return;
      if (on) set[i] = true; else delete set[i];
    });
    d[key] = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    save();
    return { ok: true };
  }

  function setDanteAll(devId, side, on) {
    var d = getDevice(devId);
    if (!d || d.type !== 'mixer') return { ok: false, msg: '仅调音台支持 Dante 分配。' };
    var ports = [];
    var n = side === 'in' ? d.inputs.length : d.outputs.length;
    for (var i = 0; i < n; i++) ports.push(i);
    return setDante(devId, side, ports, on);
  }

  function removeNetLink(aid, bid) {
    var before = state.connections.length;
    state.connections = state.connections.filter(function (c) {
      if (!c.net) return true;
      return !((c.sid === aid && c.tid === bid) || (c.sid === bid && c.tid === aid));
    });
    var removed = before - state.connections.length;
    if (removed) save();
    return removed;
  }

  function removeNetLink(aid, bid) {
    var before = state.connections.length;
    state.connections = state.connections.filter(function (c) {
      if (!c.net) return true;
      return !((c.sid === aid && c.tid === bid) || (c.sid === bid && c.tid === aid));
    });
    var removed = before - state.connections.length;
    if (removed) save();
    return removed;
  }

  function connWarning(c) {
    var s = getDevice(c.sid), t = getDevice(c.tid);
    if (!s || !t) return null;
    if (c.net) return null;   /* 网口线：数字层，无音频警示 */
    var list = [];
    var err = connectionError(c);
    if (err) list.push(err);
    var so = signalOf(s, 'out'), ti = signalOf(t, 'in');
    if (!err && so !== ti) {
      list.push('信号类型不一致：' + signalName(so) + '输出 → ' + signalName(ti) + '输入');
    }
    var pw = powerWarning(c);
    if (pw) list.push(pw);
    return list.length ? list.join('；') : null;
  }

  function connectionError(c) {
    var s = getDevice(c.sid), t = getDevice(c.tid);
    if (!s || !t) return null;
    /* 网口线是独立数字层，不做音频信号校验 */
    if (c.net) return null;
    /* 交换机只通过网口线连接（右键调音台 / 交换机添加），不接音频线 */
    if (s.type === 'switch' || t.type === 'switch') {
      return '交换机只通过网口线连接（右键设备 → 网口线）。';
    }
    if (t.type !== 'speaker') return null;
    var so = signalOf(s, 'out');
    if (speakerPowered(t) && so === 'speaker') {
      return '有源音箱不能接音响线/功放输出。';
    }
    if (!speakerPowered(t) && so === 'line') {
      return '无源音箱不能接信号线，必须接功放音响线。';
    }
    /* 需求 A：无源音箱最多从功放接入一条音响线，其余输入口只能用于 link 串接。
       检测该音箱是否已有「另一个输入口」来自功放（换口重连不算） */
    if (!speakerPowered(t) && s.type === 'amp') {
      var hasAmpFeed = state.connections.some(function (x) {
        if (x.tid !== t.id || x.tport === c.tport) return false;
        var xs = getDevice(x.sid);
        return xs && xs.type === 'amp';
      });
      if (hasAmpFeed) {
        return '音箱只能从功放接入一条音响线，其余端口用于 link 串接。';
      }
    }
    return null;
  }

  function cleanupConnectionErrors() {
    var removed = [];
    /* 逐条检查并渐进保留：像「音箱多条功放线」这类相互冲突的连线
       只清多余的一条，而不是把两条都删掉 */
    var all = state.connections;
    var kept = [];
    state.connections = kept;
    all.forEach(function (c) {
      var err = connectionError(c);
      if (!err) { kept.push(c); return; }
      var s = getDevice(c.sid), t = getDevice(c.tid);
      removed.push((s ? s.name : '?') + ' → ' + (t ? t.name : '?') + '：' + err);
    });
    if (removed.length) save();
    return removed;
  }

  function powerNumber(v) {
    var nums = String(v || '').match(/\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) return 0;
    return nums.map(function (n) { return +n; }).reduce(function (a, b) { return Math.max(a, b); }, 0);
  }

  function fmtPower(n) {
    return Math.round(n * 10) / 10 + 'W';
  }

  function fmtOhms(n) {
    return Math.round(n * 100) / 100 + 'Ω';
  }

  function ohmsNumber(v) {
    var nums = String(v || '').match(/\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) return 0;
    return nums.map(function (n) { return +n; })
      .filter(function (n) { return n > 0; })
      .reduce(function (a, b) { return Math.min(a, b); }, Infinity) || 0;
  }

  /* ---------- 功放阻抗-功率换算 ----------
     功放标称功率按 8Ω 计。2–16Ω 内连续折算：
       16Ω → ×0.5，8Ω → ×1.0，4Ω → ×1.5，2Ω → ×2.0。
     中间值（例如 6Ω）线性过渡；超出范围按 2Ω/16Ω 边界钳制。
     若模板/设备填写了 4Ω 实际功率（specs.power4），4Ω 附近优先用实填值插值。 */
  function ampImpedanceFactor(loadOhm) {
    loadOhm = +loadOhm || 0;
    if (!loadOhm) return 1;
    if (loadOhm <= 2) return 2;
    if (loadOhm < 4) return 2 - (loadOhm - 2) * 0.25;
    if (loadOhm < 8) return 1.5 - (loadOhm - 4) * 0.125;
    if (loadOhm < 16) return 1 - (loadOhm - 8) * 0.0625;
    return 0.5;
  }
  function interp(a, b, t) { return a + (b - a) * t; }
  /* 功放在给定负载阻抗下的可用功率（rated8 = 8Ω 标称；rated4 选填） */
  function ampEffectivePower(rated8W, loadOhm, rated4W) {
    var load = +loadOhm || 0;
    var r8 = powerNumber(rated8W);
    var r4 = powerNumber(rated4W);
    if (load && r4 && load >= 4 && load < 8) {
      if (r8) return Math.round(interp(r8, r4, (8 - load) / 4));
      return Math.round(r4 * ampImpedanceFactor(load) / ampImpedanceFactor(4));
    }
    return Math.round(r8 * ampImpedanceFactor(load));
  }
  function ampEffectivePowerFromSpecs(specs, loadOhm) {
    specs = specs || {};
    return ampEffectivePower(specs.power, loadOhm, specs.power4);
  }
  /* 把功放在当前负载下的能力折算回 8Ω 标称口径，供反推选型使用。 */
  function ampRatedEquivalentPower(specs, loadOhm) {
    specs = specs || {};
    var load = +loadOhm || 8;
    var factor = ampImpedanceFactor(load);
    return factor ? Math.round(ampEffectivePower(specs.power, load, specs.power4) / factor) : 0;
  }
  function ampRatedOhmFromSpecs(specs) {
    var o = ohmsNumber(specs && specs.ohms);
    return o || 4;
  }
  /* 功放额定阻抗（其可安全驱动的最低负载），默认 4Ω */
  function ampRatedOhm(dev) {
    return ampRatedOhmFromSpecs(dev && dev.specs);
  }

  /* 智能配接：从模板库挑最合适的功放。
     opt.channels（2/4/空=任意）按通道过滤；opt.needRatedW = 达标所需 8Ω 标称功率。
     4Ω 负载若填了 power4，会折算回 8Ω 口径参与排序。
     选功率 ≥ 需求里最小的（最接近够用）；都不够则选最大的；无功率信息则第一台。 */
  function pickAmpTemplate(templates, opt) {
    opt = opt || {};
    var ch = +opt.channels || 0;
    var need = +opt.needRatedW || +opt.needW || 0;
    var loadOhm = +opt.loadOhm || 0;
    var cand = (templates || []).filter(function (t) {
      if (!t || t.type !== 'amp') return false;
      if (ch) {
        var outs = Array.isArray(t.outs) ? t.outs.length : +t.outs || 0;
        if (t.ins !== ch && outs !== ch) return false;
      }
      return true;
    });
    if (!cand.length) return null;
    if (loadOhm) {
      var safe = cand.filter(function (t) { return loadOhm >= ampRatedOhmFromSpecs(t.specs); });
      if (safe.length) cand = safe;
    }
    function candPower(t) {
      return loadOhm ? ampRatedEquivalentPower(t.specs, loadOhm) : powerNumber(t.specs && t.specs.power);
    }
    var target = need;
    var withW = cand.filter(function (t) { return candPower(t) > 0; });
    if (!withW.length) return cand[0];
    var fit = null, fitW = Infinity, max = null, maxW = -1;
    withW.forEach(function (t) {
      var w = candPower(t);
      if (w >= target && w < fitW) { fitW = w; fit = t; }
      if (w > maxW) { maxW = w; max = t; }
    });
    if (!target) return max || fit || withW[0];
    return fit || max;
  }

  var POWER_ALARM_MODES = [
    { key: 'speech', name: '1.2 · 会议人声', factor: 1.2, min: 1.2 },
    { key: 'show', name: '1.5 · 驻唱小场', factor: 1.5, min: 1.5 },
    { key: 'band', name: '2 · 商演乐队', factor: 2, min: 2 },
    { key: 'dj', name: '3 · DJ摇滚', factor: 3, min: 3 },
    { key: 'electro', name: '4 · 电音超低', factor: 4, min: 4 }
  ];

  function powerAlarmMode(key) {
    for (var i = 0; i < POWER_ALARM_MODES.length; i++) {
      if (POWER_ALARM_MODES[i].key === key) return POWER_ALARM_MODES[i];
    }
    return POWER_ALARM_MODES[1];
  }

  function setPowerAlarmMode(key) {
    state.powerAlarmMode = powerAlarmMode(key).key;
    save({ noHistory: true });
  }

  function collectPassiveSpeakerLoad(dev, list, seen) {
    if (!dev || dev.type !== 'speaker' || speakerPowered(dev) || seen[dev.id]) return;
    seen[dev.id] = true;
    list.push(dev);
    visibleOuts(dev).forEach(function (oi) {
      consumersOf(dev.id, oi).forEach(function (c) {
        var t = getDevice(c.tid);
        if (t && t.type === 'speaker' && !speakerPowered(t)) {
          collectPassiveSpeakerLoad(t, list, seen);
        }
      });
    });
  }

  function powerAlarmForOutput(ampId, sport, modeKey) {
    var amp = getDevice(ampId);
    if (!amp || amp.type !== 'amp' || isHiddenOut(amp, sport)) return null;
    var roots = [];
    consumersOf(amp.id, sport).forEach(function (c) {
      var t = getDevice(c.tid);
      if (t && t.type === 'speaker' && !speakerPowered(t)) roots.push(t);
    });
    if (!roots.length) return null;

    var speakers = [];
    roots.forEach(function (sp) { collectPassiveSpeakerLoad(sp, speakers, {}); });
    if (!speakers.length) return null;

    var mode = powerAlarmMode(modeKey || state.powerAlarmMode);
    var ratedW = powerNumber(amp.specs && amp.specs.power);    /* 8Ω 标称 */
    var rated4W = powerNumber(amp.specs && amp.specs.power4);  /* 4Ω 实填，选填 */
    var totalW = 0, invOhms = 0;
    var missingPower = [], missingOhms = [], hasSub = false;
    speakers.forEach(function (sp) {
      var w = powerNumber(sp.specs && sp.specs.power);
      var ohm = ohmsNumber(sp.specs && sp.specs.ohms);
      if (w) totalW += w; else missingPower.push(sp);
      if (ohm) invOhms += 1 / ohm; else missingOhms.push(sp);
      if ((sp.speakerRole || 'fullrange') === 'sub') hasSub = true;
    });
    var loadOhms = (!missingOhms.length && invOhms > 0) ? 1 / invOhms : 0;
    /* 功放在当前负载阻抗下的可用功率（4Ω→×1.5 等）；阻抗未知时按标称 */
    var factor = ampImpedanceFactor(loadOhms);
    var ampW = loadOhms ? ampEffectivePower(ratedW, loadOhms, rated4W) : ratedW;
    var usedRated4 = !!(rated4W && loadOhms && loadOhms < 8 && loadOhms >= 4);
    var boosted = factor > 1 && (ratedW > 0 || rated4W > 0);
    var minFactor = mode.factor || mode.min || 1.5;
    var minNeed = totalW ? totalW * minFactor : 0;
    var issues = [];
    function issue(level, text) { issues.push({ level: level, text: text }); }

    if (!ratedW) {
      issue('warn', '功放未填写功率，无法判断余量。');
    }
    if (missingPower.length) {
      issue('warn', '以下音箱未填写功率：' + missingPower.map(function (d) { return d.name; }).join('、'));
    }
    if (totalW && ampW) {
      /* 用负载阻抗下的可用功率 ampW 比较（而非 8Ω 标称） */
      if (ampW < totalW) {
        issue('error', '功放功率 ' + fmtPower(ampW) +
          (boosted ? '（' + fmtOhms(loadOhms) + '负载）' : '') +
          ' 小于音箱总功率 ' + fmtPower(totalW) + '。');
      }
      if (ampW < minNeed) {
        issue('error', '功放余量不足：' + mode.name + ' 最低需要 ×' + minFactor +
          '，需要 ' + fmtPower(minNeed) +
          (boosted ? '（当前 ' + fmtOhms(loadOhms) + ' 负载可用 ' + fmtPower(ampW) + '）' : '') + '。');
      }
    }
    if (speakers.length > 1 && missingOhms.length) {
      issue('warn', '并联负载缺少阻抗，无法完整计算：' +
        missingOhms.map(function (d) { return d.name; }).join('、'));
    }
    if (loadOhms && loadOhms < ampRatedOhm(amp)) {
      issue('error', (speakers.length > 1 ? '并联后' : '') + '负载阻抗 ' +
        fmtOhms(loadOhms) + ' 低于功放额定 ' + fmtOhms(ampRatedOhm(amp)) +
        '，请减少并联或更换功放/接法。');
    }
    if (hasSub) {
      issue('info', '含超低负载，请结合节目动态设置 DSP RMS/PEAK Limit。');
    }

    var errors = issues.filter(function (x) { return x.level === 'error'; }).length;
    var warns = issues.filter(function (x) { return x.level === 'warn'; }).length;
    return {
      amp: amp, sport: sport, mode: mode, speakers: speakers, hasSub: hasSub,
      ampW: ampW, ratedW: ratedW, rated4W: rated4W, factor: factor,
      boosted: boosted, usedRated4: usedRated4,
      totalW: Math.round(totalW * 10) / 10,
      loadOhms: loadOhms ? Math.round(loadOhms * 100) / 100 : 0,
      minFactor: minFactor,
      minNeed: Math.round(minNeed * 10) / 10,
      issues: issues, errors: errors, warnings: warns,
      ok: !errors && !warns && !!ratedW && !!totalW
    };
  }

  /* 功放各输出的负载概览（供设备栏详情/报告显示 4Ω 加成标注） */
  function ampLoadSummary(ampId) {
    var amp = getDevice(ampId);
    if (!amp || amp.type !== 'amp') return [];
    var out = [];
    visibleOuts(amp).forEach(function (oi) {
      var r = powerAlarmForOutput(amp.id, oi, state.powerAlarmMode);
      if (!r || !r.speakers.length) return;
      out.push({ port: oi, label: outLabelOf(amp, oi),
        loadOhms: r.loadOhms, factor: r.factor, boosted: r.boosted,
        ratedW: r.ratedW, rated4W: r.rated4W, usedRated4: r.usedRated4,
        ampW: r.ampW, totalW: r.totalW, count: r.speakers.length });
    });
    return out;
  }

  function powerAlarmResults(modeKey) {
    var mode = powerAlarmMode(modeKey || state.powerAlarmMode);
    var rows = [];
    state.devices.forEach(function (d) {
      if (d.type !== 'amp') return;
      visibleOuts(d).forEach(function (oi) {
        var r = powerAlarmForOutput(d.id, oi, mode.key);
        if (r) rows.push(r);
      });
    });
    var summary = { errors: 0, warnings: 0, ok: 0 };
    rows.forEach(function (r) {
      summary.errors += r.errors;
      summary.warnings += r.warnings;
      if (r.ok) summary.ok++;
    });
    return { mode: mode, rows: rows, summary: summary };
  }

  function powerWarning(c) {
    var s = getDevice(c.sid), t = getDevice(c.tid);
    if (!s || !t || s.type !== 'amp' || t.type !== 'speaker') return null;
    if (speakerPowered(t)) return null;
    var r = powerAlarmForOutput(s.id, c.sport, state.powerAlarmMode);
    if (!r) return null;
    var list = r.issues.filter(function (x) { return x.level === 'error' || x.level === 'warn'; });
    if (!list.length) return null;
    return '功率报警（' + r.mode.name + '）：' + list.map(function (x) { return x.text; }).join('；');
  }

  /* ---------- 统计：线材汇总 / 机柜 U 数 / 供电功率 ---------- */

  function cableSummary() {
    var groups = {};
    var order = [];
    state.connections.forEach(function (c) {
      if (!getDevice(c.sid) || !getDevice(c.tid)) return;
      var k = cableOf(c);
      if (!groups[k]) {
        groups[k] = { type: k, count: 0, meters: 0, missing: 0, lengths: {} };
        order.push(k);
      }
      var g = groups[k];
      g.count++;
      var m = parseFloat(c.lenM);
      if (m > 0) {
        var rounded = Math.round(m * 10) / 10;
        var lk = String(rounded);
        g.meters += rounded;
        g.lengths[lk] = (g.lengths[lk] || 0) + 1;
      } else {
        g.missing++;
      }
    });
    return order.map(function (k) {
      groups[k].meters = Math.round(groups[k].meters * 10) / 10;
      groups[k].lengthBreakdown = Object.keys(groups[k].lengths)
        .sort(function (a, b) { return parseFloat(a) - parseFloat(b); })
        .map(function (len) { return { len: parseFloat(len), count: groups[k].lengths[len] }; });
      return groups[k];
    });
  }

  function rackSummary() {
    var byType = {};
    var totalU = 0;
    var missing = [];
    state.devices.forEach(function (d) {
      if (d.type !== 'mixer' && d.type !== 'dsp' && d.type !== 'amp') return;
      var u = parseFloat(d.specs && d.specs.rackU);
      if (u > 0) {
        byType[d.type] = (byType[d.type] || 0) + u;
        totalU += u;
      } else {
        missing.push(d);
      }
    });
    var seqU = 1;   /* 电源时序器默认 1U */
    return {
      byType: byType, totalU: totalU, seqU: seqU, missing: missing,
      suggestMin: Math.ceil(totalU + seqU + 3),   /* 散热+安装余量 3–5U */
      suggestMax: Math.ceil(totalU + seqU + 5)
    };
  }

  /* 供电功率：功放/有源音箱额定功率 ÷ 效率 × 节目负载系数 + 周边固定值，× 动态余量 */
  var POWER_LEVELS = [
    { key: 'conf', name: '会议 / 背景音乐', factor: 0.125 },
    { key: 'std',  name: '常规演出 / 流行', factor: 0.25 },
    { key: 'rock', name: '摇滚 / 电音大动态', factor: 0.4 }
  ];
  var STD_BREAKERS = [10, 16, 20, 25, 32, 40, 63, 100, 125];

  function powerSummary() {
    var cfg = state.power || {};
    var eff = +cfg.eff || 0.7;
    var headroom = +cfg.headroom || 1.3;
    var ampW = 0, spkW = 0, mixers = 0, dsps = 0;
    var missing = [];
    state.devices.forEach(function (d) {
      if (d.type === 'amp') {
        var w = powerNumber(d.specs && d.specs.power);
        if (w) ampW += w; else missing.push(d);
      } else if (d.type === 'speaker' && speakerPowered(d)) {
        var w2 = powerNumber(d.specs && d.specs.power);
        if (w2) spkW += w2; else missing.push(d);
      } else if (d.type === 'mixer') mixers++;
      else if (d.type === 'dsp') dsps++;
    });
    var fixed = mixers * (+cfg.mixerW || 150) + dsps * (+cfg.dspW || 50) + (+cfg.seqW || 30);
    var levels = POWER_LEVELS.map(function (lv) {
      var draw = (ampW + spkW) / eff * lv.factor + fixed;
      var total = draw * headroom;
      var kw = Math.max(1, Math.ceil(total / 1000));
      var amps = total / 220;
      var breaker = null;
      for (var i = 0; i < STD_BREAKERS.length; i++) {
        if (STD_BREAKERS[i] >= amps * 1.25) { breaker = STD_BREAKERS[i]; break; }
      }
      return {
        key: lv.key, name: lv.name, factor: lv.factor,
        draw: Math.round(draw), total: Math.round(total),
        kw: kw, amps: Math.round(amps * 10) / 10,
        breaker: breaker, threePhase: kw > 7
      };
    });
    return { ampW: ampW, spkW: spkW, fixed: fixed, eff: eff, headroom: headroom,
      mixers: mixers, dsps: dsps, missing: missing, levels: levels };
  }

  /* 线材：未手动指定时按信号类型给默认值 */
  function cableOf(c) {
    if (c.cable) return c.cable;
    var s = getDevice(c.sid);
    return (s && signalOf(s, 'out') === 'speaker') ? '音箱线' : '卡农信号线';
  }

  /* 线色：连接自定义色 > 源设备颜色；网口线用专属青绿色 */
  function colorOf(c) {
    if (c.color) return c.color;
    if (c.net) return SP.NET_COLOR;
    var s = getDevice(c.sid);
    return (s && s.color) || '#d99a3f';
  }

  /* 是否喇叭级线路（框图中加粗显示） */
  function isSpeakerRun(c) {
    var s = getDevice(c.sid);
    return !!s && signalOf(s, 'out') === 'speaker';
  }

  /* ---------- 接线教学：乐器/话筒 ↔ 调音台输入 ---------- */

  function gearById(id) {
    for (var i = 0; i < state.inputGear.length; i++) {
      if (state.inputGear[i].id === id) return state.inputGear[i];
    }
    return null;
  }
  function setGearPatch(devId, port, gearId) {
    var d = getDevice(devId);
    if (!d || d.type !== 'mixer') return;
    if (!d.gearPatch) d.gearPatch = {};
    if (gearId) d.gearPatch[port] = gearId;
    else delete d.gearPatch[port];
    save();
  }
  /* ---------- 外围输入设备清单 ---------- */

  function addGear() {
    state.inputGear.push({ id: 'g' + (state.seq++), name: '', cat: SP.GEAR_CATS[0], qty: 1, note: '' });
    save();
  }
  function removeGear(idx) {
    state.inputGear.splice(idx, 1);
    save();
  }

  /* ---------- 乐手小卡 / 本场阵容 ---------- */

  function nextId(prefix) { return prefix + (state.seq++); }

  function performerTemplateById(id) {
    for (var i = 0; i < state.performerTemplates.length; i++) {
      if (state.performerTemplates[i].id === id) return state.performerTemplates[i];
    }
    return null;
  }

  function showPerformerById(id) {
    for (var i = 0; i < state.showRoster.length; i++) {
      if (state.showRoster[i].id === id) return state.showRoster[i];
    }
    return null;
  }

  function standbyRosterById(id) {
    for (var i = 0; i < state.standbyRosters.length; i++) {
      if (state.standbyRosters[i].id === id) return state.standbyRosters[i];
    }
    return null;
  }

  function cloneTemplateToRoster(t, prefix) {
    var p = clone(t);
    p.id = nextId(prefix || 'show');
    p.templateId = t.id;
    p.sources.forEach(function (x) { x.id = nextId('src'); });
    p.outputs.forEach(function (x) { x.id = nextId('pout'); });
    p.stage = { zone: '', x: null, y: null, rotation: 0, modelAssetId: p.modelAssetId || '' };
    normalizePerformerData(p, state, true);
    return p;
  }

  function syncRosterSnapshot(p, t) {
    var oldSources = p.sources || [], oldOutputs = p.outputs || [];
    var keep = { id: p.id, templateId: t.id, stage: clone(p.stage || {}), entryTime: p.entryTime || '' };
    var fresh = clone(t);
    Object.keys(p).forEach(function (k) { delete p[k]; });
    Object.assign(p, fresh, keep);
    p.sources.forEach(function (x, i) { x.id = oldSources[i] ? oldSources[i].id : nextId('src'); });
    p.outputs.forEach(function (x, i) { x.id = oldOutputs[i] ? oldOutputs[i].id : nextId('pout'); });
    normalizePerformerData(p, state, true);
    return p;
  }

  function newPerformerSource(name) {
    return {
      id: nextId('src'), name: name || '主输入', device: '', category: '话筒', connector: 'XLR',
      physicalInputs: 1, channels: 1, enabled: true, phantom: false, stage: true, note: ''
    };
  }

  function addPerformerTemplate(characterType) {
    var mascot = characterType === 'mascot';
    var p = {
      id: nextId(mascot ? 'mascot' : 'perf'), name: mascot ? '新吉祥物' : '新乐手', characterType:mascot ? 'mascot' : 'performer',
      role: 'other', roleCustom: mascot ? '吉祥物' : '', photoId: '', photoAsset: '',
      photoGallery: [], primaryPhotoKey: '', photoAspect: '9:16',
      modelAssetId: '', localModelId: '', modelFileName: '', modelFormat: '', notes: '',
      sources: mascot ? [] : [newPerformerSource('主输入')],
      monitor: mascot ? Object.assign(defaultPerformerMonitor(), { type:'无', mixes:0, stage:false }) : defaultPerformerMonitor(),
      outputs: [], specialRoutes: '',
      stageDefaults: mascot ? { x:6.5, y:-3, z:0.6, rotation:0, scale:1, targetHeightM:0.45 } : { x:0, y:0, z:0.6, rotation:0, scale:1, targetHeightM:1.68 }
    };
    state.performerTemplates.push(p);
    save();
    return p;
  }

  function duplicatePerformerTemplate(id) {
    var src = performerTemplateById(id);
    if (!src) return null;
    var p = clone(src);
    p.id = nextId(src.characterType === 'mascot' ? 'mascot' : 'perf');
    p.name = src.name + ' 副本';
    p.sources.forEach(function (x) { x.id = nextId('src'); });
    p.outputs.forEach(function (x) { x.id = nextId('pout'); });
    state.performerTemplates.push(p);
    save();
    return p;
  }

  function removePerformerTemplate(id) {
    var before = state.performerTemplates.length;
    state.performerTemplates = state.performerTemplates.filter(function (p) { return p.id !== id; });
    if (state.performerTemplates.length === before) return false;
    state.showRoster.forEach(function (p) { if (p.templateId === id) p.templateId = ''; });
    state.standbyRosters.forEach(function (r) {
      r.members.forEach(function (p) { if (p.templateId === id) p.templateId = ''; });
    });
    save();
    return true;
  }

  function addPerformerSource(templateId) {
    var p = performerTemplateById(templateId);
    if (!p || p.characterType === 'mascot') return null;
    var src = newPerformerSource('新增输入');
    p.sources.push(src);
    save();
    return src;
  }

  function removePerformerSource(templateId, sourceId) {
    var p = performerTemplateById(templateId);
    if (!p) return false;
    var before = p.sources.length;
    p.sources = p.sources.filter(function (x) { return x.id !== sourceId; });
    if (p.sources.length === before) return false;
    save();
    return true;
  }

  function addPerformerOutput(templateId) {
    var p = performerTemplateById(templateId);
    if (!p || p.characterType === 'mascot') return null;
    var out = { id: nextId('pout'), name: '特殊输出', count: 1, connector: 'XLR',
      routeType: 'direct', stage: true, note: '' };
    p.outputs.push(out);
    save();
    return out;
  }

  function removePerformerOutput(templateId, outputId) {
    var p = performerTemplateById(templateId);
    if (!p) return false;
    var before = p.outputs.length;
    p.outputs = p.outputs.filter(function (x) { return x.id !== outputId; });
    if (p.outputs.length === before) return false;
    save();
    return true;
  }

  function addShowPerformer(templateId) {
    var t = performerTemplateById(templateId);
    if (!t || t.characterType === 'mascot') return null;
    var p = cloneTemplateToRoster(t, 'show');
    state.showRoster.push(p);
    save();
    return p;
  }

  function addShowPerformerRecord(data) {
    data = clone(data || {});
    if (data.id && showPerformerById(data.id)) return showPerformerById(data.id);
    data.id = data.id || nextId('show');
    data.templateId = data.templateId || '';
    data.name = data.name || '舞台乐手';
    data.role = data.role || 'other';
    data.sources = Array.isArray(data.sources) ? data.sources : [];
    data.outputs = Array.isArray(data.outputs) ? data.outputs : [];
    data.monitor = data.monitor || defaultPerformerMonitor();
    normalizePerformerData(data, state, true);
    state.showRoster.push(data);
    save();
    return data;
  }

  function removeShowPerformer(id) {
    var before = state.showRoster.length;
    state.showRoster = state.showRoster.filter(function (p) { return p.id !== id; });
    if (state.showRoster.length === before) return false;
    save();
    return true;
  }

  function removeShowPerformersByTemplate(templateId) {
    var removed = state.showRoster.filter(function (p) { return p.templateId === templateId; });
    if (!removed.length) return [];
    var ids = {};
    removed.forEach(function (p) { ids[p.id] = true; });
    state.showRoster = state.showRoster.filter(function (p) { return !ids[p.id]; });
    save();
    return removed;
  }

  function createStandbyRosters(count) {
    count = Math.max(1, Math.min(20, nonNegInt(count, 1)));
    var made = [];
    for (var i = 0; i < count; i++) {
      var r = { id: nextId('standby'), name: '预备场 ' + (state.standbyRosters.length + 1), entryTime: '', members: [] };
      state.standbyRosters.push(r); made.push(r);
    }
    save();
    return made;
  }

  function duplicateStandbyRoster(id) {
    var src = standbyRosterById(id);
    if (!src) return null;
    var r = { id: nextId('standby'), name: src.name + ' 副本', entryTime: src.entryTime, members: [] };
    src.members.forEach(function (p) {
      var copy = clone(p);
      copy.id = nextId('reserve');
      copy.sources.forEach(function (x) { x.id = nextId('src'); });
      copy.outputs.forEach(function (x) { x.id = nextId('pout'); });
      r.members.push(copy);
    });
    state.standbyRosters.push(r); save();
    return r;
  }

  function removeStandbyRoster(id) {
    var before = state.standbyRosters.length;
    state.standbyRosters = state.standbyRosters.filter(function (r) { return r.id !== id; });
    if (before === state.standbyRosters.length) return false;
    save(); return true;
  }

  function addStandbyPerformer(rosterId, templateId, count) {
    var r = standbyRosterById(rosterId), t = performerTemplateById(templateId);
    if (!r || !t || t.characterType === 'mascot') return [];
    count = Math.max(1, Math.min(50, nonNegInt(count, 1)));
    var made = [];
    for (var i = 0; i < count; i++) {
      var p = cloneTemplateToRoster(t, 'reserve');
      p.entryTime = r.entryTime || '';
      r.members.push(p); made.push(p);
    }
    save(); return made;
  }

  function duplicateStandbyMembers(rosterId, ids) {
    var r = standbyRosterById(rosterId), selected = {};
    (ids || []).forEach(function (id) { selected[id] = true; });
    if (!r) return [];
    var made = [];
    r.members.filter(function (p) { return selected[p.id]; }).forEach(function (p) {
      var copy = clone(p);
      copy.id = nextId('reserve');
      copy.sources.forEach(function (x) { x.id = nextId('src'); });
      copy.outputs.forEach(function (x) { x.id = nextId('pout'); });
      r.members.push(copy); made.push(copy);
    });
    if (made.length) save();
    return made;
  }

  function removeStandbyMembers(rosterId, ids) {
    var r = standbyRosterById(rosterId), selected = {};
    (ids || []).forEach(function (id) { selected[id] = true; });
    if (!r) return 0;
    var before = r.members.length;
    r.members = r.members.filter(function (p) { return !selected[p.id]; });
    if (before !== r.members.length) save();
    return before - r.members.length;
  }

  function syncPerformerTemplate(templateId) {
    var t = performerTemplateById(templateId);
    if (!t) return { show: 0, standby: 0 };
    var result = { show: 0, standby: 0 };
    state.showRoster.forEach(function (p) {
      if (p.templateId === templateId) { syncRosterSnapshot(p, t); result.show++; }
    });
    state.standbyRosters.forEach(function (r) {
      r.members.forEach(function (p) {
        if (p.templateId === templateId) { syncRosterSnapshot(p, t); result.standby++; }
      });
    });
    if (result.show || result.standby) save();
    return result;
  }

  function performerPlacementCounts(templateId) {
    var counts = { show: 0, standby: 0, stage: 0 };
    state.showRoster.forEach(function (p) { if (p.templateId === templateId) counts.show++; });
    state.standbyRosters.forEach(function (r) {
      r.members.forEach(function (p) { if (p.templateId === templateId) counts.standby++; });
    });
    var result = state.showPlan && state.showPlan.stageResult;
    var items = result && result.showPlan && Array.isArray(result.showPlan.stageItems) ? result.showPlan.stageItems : [];
    items.forEach(function (item) { if (item.category === 'mascot' && item.templateId === templateId) counts.stage++; });
    return counts;
  }

  function isPlannedDoublePatch(performerId, sourceId, lineIndex) {
    var map = state.mixerPlanning.doublePatchInputs || {};
    return !!map[plannedDoubleKey(performerId, sourceId, lineIndex)];
  }

  function setPlannedDoublePatch(performerId, sourceId, lineIndex, on) {
    var map = state.mixerPlanning.doublePatchInputs || (state.mixerPlanning.doublePatchInputs = {});
    var key = plannedDoubleKey(performerId, sourceId, lineIndex);
    if (on) map[key] = true; else delete map[key];
    save();
    return !!on;
  }

  function spanLabel(prefix, start, count) {
    if (!count) return '—';
    return prefix + start + (count > 1 ? '–' + (start + count - 1) : '');
  }

  function stageBoxSuggestion(inputs, outputs) {
    inputs = nonNegInt(inputs, 0);
    outputs = nonNegInt(outputs, 0);
    if (!inputs && !outputs) return { inputs: 0, outputs: 0, capacityIn: 0, capacityOut: 0,
      boxes: [], label: '无需舞台接口箱' };
    var types = [
      { name: '16×8', ins: 16, outs: 8 },
      { name: '24×12', ins: 24, outs: 12 },
      { name: '32×16', ins: 32, outs: 16 }
    ];
    var best = null;
    for (var a = 0; a <= 6; a++) {
      for (var b = 0; b <= 6; b++) {
        for (var c = 0; c <= 6; c++) {
          var qty = a + b + c;
          if (!qty || qty > 6) continue;
          var capIn = a * 16 + b * 24 + c * 32;
          var capOut = a * 8 + b * 12 + c * 16;
          if (capIn < inputs || capOut < outputs) continue;
          var score = qty * 1000000 + (capIn - inputs) * 100 + (capOut - outputs);
          if (!best || score < best.score) best = { counts: [a, b, c], capIn: capIn, capOut: capOut, score: score };
        }
      }
    }
    if (!best) {
      var n = Math.max(Math.ceil(inputs / 32), Math.ceil(outputs / 16));
      best = { counts: [0, 0, n], capIn: n * 32, capOut: n * 16 };
    }
    var boxes = [];
    best.counts.forEach(function (n, i) { if (n) boxes.push(n + '× ' + types[i].name); });
    return { inputs: inputs, outputs: outputs, capacityIn: best.capIn, capacityOut: best.capOut,
      boxes: boxes, label: boxes.join(' + ') };
  }

  /* 纯计算：阵容与习惯 → 输入、Bus、Matrix、物理输出和舞台接口箱需求。 */
  function calculateMixerPlan(roster, prefs) {
    roster = Array.isArray(roster) ? roster : state.showRoster;
    roster = roster.filter(function (person) { return person && person.characterType !== 'mascot'; });
    prefs = Object.assign(defaultMixerPlanning(), prefs || state.mixerPlanning || {});
    var physicalCursor = 1, channelCursor = 1, outputCursor = 1, busCursor = 1, matrixCursor = 1;
    var stageInputs = 0, stageOutputs = 0, monitorMixes = 0;
    var inputRows = [], inputLines = [], outputRows = [], inputPatch = {};
    var doubleMap = prefs.doublePatchInputs || {};
    var preset = ['classic4', 'mainOnly', 'custom'].indexOf(prefs.outputPreset) >= 0 ? prefs.outputPreset : 'classic4';
    var mainCount = preset === 'custom' ? nonNegInt(prefs.mainOutputs, 2) : 2;
    if (preset === 'classic4') {
      outputRows.push(
        { performerId: '', performer: '系统', purpose: '主扩声 L', route: 'MAIN 1', routeIds: ['m0'],
          connector: 'XLR', physical: 'OUT 1', count: 1, stage: prefs.mainAtStage !== false, note: '经典四路' },
        { performerId: '', performer: '系统', purpose: '主扩声 R', route: 'MAIN 2', routeIds: ['m1'],
          connector: 'XLR', physical: 'OUT 2', count: 1, stage: prefs.mainAtStage !== false, note: '经典四路' },
        { performerId: '', performer: '系统', purpose: '返听', route: 'BUS 1', routeIds: ['b0'],
          connector: 'XLR', physical: 'OUT 3', count: 1, stage: true, tap: prefs.monitorTap, note: '经典四路' },
        { performerId: '', performer: '系统', purpose: '超低', route: 'MATRIX 1', routeIds: ['x0'],
          connector: 'XLR', physical: 'OUT 4', count: 1, stage: true, note: '经典四路' }
      );
      if (prefs.mainAtStage !== false) stageOutputs += 2;
      stageOutputs += 2;
      outputCursor = 5; busCursor = 2; matrixCursor = 2;
    } else if (mainCount) {
      var mainRouteIds = [];
      for (var mainI = 0; mainI < mainCount; mainI++) mainRouteIds.push('m' + mainI);
      outputRows.push({ performerId: '', performer: '系统', purpose: '主扩声', route: spanLabel('MAIN ', 1, mainCount),
        routeIds: mainRouteIds,
        connector: 'XLR', physical: spanLabel('OUT ', outputCursor, mainCount), count: mainCount,
        stage: prefs.mainAtStage !== false, note: '' });
      if (prefs.mainAtStage !== false) stageOutputs += mainCount;
      outputCursor += mainCount;
    }

    roster.forEach(function (p) {
      (p.sources || []).forEach(function (src) {
        if (src.enabled === false) return;
        var phys = Math.max(1, nonNegInt(src.physicalInputs, 1));
        var baseCh = Math.max(phys, nonNegInt(src.channels, phys));
        var sourcePhysicalStart = physicalCursor;
        var sourceChannelStart = channelCursor;
        var basePerLine = [];
        for (var bi = 0; bi < phys; bi++) basePerLine.push(1);
        for (var extra = 0; extra < baseCh - phys; extra++) basePerLine[extra % phys]++;
        var doubleCount = 0;
        for (var li = 0; li < phys; li++) {
          var suffix = phys === 2 ? (li === 0 ? ' L' : ' R') : (phys > 1 ? ' ' + (li + 1) : '');
          var patchChannels = [];
          for (var bc = 0; bc < basePerLine[li]; bc++) patchChannels.push(channelCursor++ - 1);
          var doubleKey = plannedDoubleKey(p.id, src.id, li);
          var doubled = !!doubleMap[doubleKey];
          if (doubled) { patchChannels.push(channelCursor++ - 1); doubleCount++; }
          inputPatch[physicalCursor - 1] = patchChannels;
          inputLines.push({ performerId: p.id, performer: p.name, sourceId: src.id,
            source: src.name + suffix, category: src.category, connector: src.connector,
            lineIndex: li, physicalIndex: physicalCursor - 1, physical: 'IN ' + physicalCursor,
            channelIndices: patchChannels, channels: spanLabel('CH ', patchChannels[0] + 1, patchChannels.length),
            doublePatch: doubled, doublePatchKey: doubleKey,
            phantom: !!src.phantom, stage: src.stage !== false, note: src.note || '' });
          physicalCursor++;
        }
        var plannedCh = channelCursor - sourceChannelStart;
        inputRows.push({
          performerId: p.id, performer: p.name, sourceId: src.id, source: src.name,
          device: src.device || '', category: src.category, connector: src.connector,
          physical: spanLabel('IN ', sourcePhysicalStart, phys), channels: spanLabel('CH ', sourceChannelStart, plannedCh),
          physicalCount: phys, channelCount: plannedCh, doublePatchCount: doubleCount,
          phantom: !!src.phantom, stage: src.stage !== false, note: src.note || ''
        });
        if (src.stage !== false) stageInputs += phys;
      });

      var mon = Object.assign(defaultPerformerMonitor(), p.monitor || {});
      var mixes = mon.type === '无' ? 0 : nonNegInt(mon.mixes, 0);
      var width = mon.stereo ? 2 : 1;
      for (var mi = 0; mi < mixes; mi++) {
        outputRows.push({ performerId: p.id, performer: p.name, purpose: mon.type + ' ' + (mi + 1),
          route: spanLabel('BUS ', busCursor, width), connector: 'XLR',
          routeIds: Array.from({ length: width }, function (_, wi) { return 'b' + (busCursor + wi - 1); }),
          physical: spanLabel('OUT ', outputCursor, width), count: width, stage: mon.stage !== false,
          tap: mon.tap === 'pre' || mon.tap === 'post' ? mon.tap : prefs.monitorTap,
          note: mon.note || '' });
        if (mon.stage !== false) stageOutputs += width;
        busCursor += width;
        outputCursor += width;
      }
      monitorMixes += mixes;

      (p.outputs || []).forEach(function (out) {
        var count = Math.max(1, nonNegInt(out.count, 1));
        var route = 'DIRECT', routeIds = [];
        if (out.routeType === 'bus') {
          route = spanLabel('BUS ', busCursor, count);
          for (var bo = 0; bo < count; bo++) routeIds.push('b' + (busCursor + bo - 1));
          busCursor += count;
        } else if (out.routeType === 'matrix') {
          route = spanLabel('MATRIX ', matrixCursor, count);
          for (var xo = 0; xo < count; xo++) routeIds.push('x' + (matrixCursor + xo - 1));
          matrixCursor += count;
        }
        outputRows.push({ performerId: p.id, performer: p.name, purpose: out.name, route: route,
          routeIds: routeIds,
          connector: out.connector, physical: spanLabel('OUT ', outputCursor, count), count: count,
          stage: out.stage !== false, note: out.note || '' });
        if (out.stage !== false) stageOutputs += count;
        outputCursor += count;
      });
    });

    var physicalInputs = physicalCursor - 1;
    var processingChannels = channelCursor - 1;
    var buses = busCursor - 1;
    var matrices = matrixCursor - 1;
    var physicalOutputs = outputCursor - 1;
    var minimum = {
      physIn: physicalInputs + nonNegInt(prefs.spareInputs, 0),
      channels: processingChannels + nonNegInt(prefs.spareChannels, 0),
      buses: buses + nonNegInt(prefs.spareBuses, 0),
      mains: mainCount,
      matrices: matrices + nonNegInt(prefs.spareMatrices, 0),
      physOut: physicalOutputs + nonNegInt(prefs.spareOutputs, 0)
    };
    return {
      performerCount: roster.length,
      physicalInputs: physicalInputs,
      processingChannels: processingChannels,
      monitorMixes: monitorMixes,
      buses: buses,
      matrices: matrices,
      physicalOutputs: physicalOutputs,
      stageInputs: stageInputs,
      stageOutputs: stageOutputs,
      minimum: minimum,
      stagebox: stageBoxSuggestion(stageInputs, stageOutputs),
      inputRows: inputRows,
      inputLines: inputLines,
      inPatch: inputPatch,
      outputRows: outputRows
    };
  }

  function syncRosterToTeaching() {
    var req = calculateMixerPlan();
    var oldGenerated = {};
    state.inputGear.forEach(function (g) { if (g.origin === 'showRoster') oldGenerated[g.id] = true; });
    var keep = state.inputGear.filter(function (g) { return g.origin !== 'showRoster'; });
    var generated = req.inputLines.map(function (line) {
      return { id: nextId('g'), name: line.performer + ' · ' + line.source, cat: line.category,
        qty: 1, note: line.connector + (line.phantom ? ' · +48V' : '') + (line.note ? ' · ' + line.note : ''),
        origin: 'showRoster', rosterId: line.performerId, sourceId: line.sourceId };
    });
    state.inputGear = keep.concat(generated);
    var d = activeMixerDev();
    var patched = 0;
    if (d) {
      var oldPatch = d.gearPatch || {}, nextPatch = {};
      Object.keys(oldPatch).forEach(function (k) {
        if (!oldGenerated[oldPatch[k]] && +k >= generated.length) nextPatch[k] = oldPatch[k];
      });
      generated.forEach(function (g, i) {
        if (i < d.inputs.length) { nextPatch[i] = g.id; patched++; }
      });
      d.gearPatch = nextPatch;
    }
    save();
    return { created: generated.length, patched: patched, total: req.physicalInputs };
  }

  function applyMixerPlan() {
    var d = activeMixerDev();
    if (!d) return { ok: false, message: '当前没有可同步的调音台' };
    var req = calculateMixerPlan();
    var m = M();
    batch(function () {
      setMixerConfig({
        physIn: Math.max(m.physIn, req.minimum.physIn),
        channels: Math.max(m.channels, req.minimum.channels),
        buses: Math.max(m.buses, req.minimum.buses),
        mains: Math.max(m.mains, req.minimum.mains),
        matrices: Math.max(m.matrices, req.minimum.matrices),
        physOut: Math.max(m.physOut, req.minimum.physOut)
      });
      M().inPatch = clone(req.inPatch);
      M().outPatch = {};
      req.outputRows.forEach(function (row) {
        var match = String(row.physical || '').match(/OUT\s+(\d+)/);
        var start = match ? +match[1] - 1 : -1;
        (row.routeIds || []).forEach(function (sourceId, i) {
          if (start >= 0 && start + i < M().physOut) M().outPatch[sourceId] = [start + i];
        });
      });
      normalizeMixer(M());
      if (state.mixerPlanning.inputPanelImgId) d.panelImgId = state.mixerPlanning.inputPanelImgId;
    });
    return { ok: true, requirements: req, mixerId: d.id };
  }

  /* ---------- 多调音台：每台调音台设备各有一份台内路由（存于 dev.mixer） ---------- */

  function mixerDevices() {
    return state.devices.filter(function (d) { return d.type === 'mixer'; });
  }
  function defaultMixerFor(d, overrides) {
    var m = defaultMixer();
    m.physIn = Math.max(1, d.inputs.length || 16);
    m.channels = m.physIn;
    m.physOut = Math.max(1, d.outputs.length || 8);
    /* 型号模板可自带台面默认值（CH/BUS/MAIN/MATRIX 数量等） */
    if (overrides) Object.assign(m, overrides);
    m.inPatch = null;
    return normalizeMixer(m);
  }
  function activeMixerDev() {
    var d = getDevice(state.activeMixerId);
    return (d && d.type === 'mixer') ? d : null;
  }
  /* 当前操作的台面：优先活动调音台设备；没有调音台时退回独立台面 state.mixer */
  function M() {
    var d = activeMixerDev();
    if (d) {
      if (!d.mixer) d.mixer = defaultMixerFor(d);
      return d.mixer;
    }
    return state.mixer;
  }
  /* 整体替换当前台面数据（模板应用 / 撤销恢复用） */
  function setMixerData(m) {
    var d = activeMixerDev();
    if (d) d.mixer = m; else state.mixer = m;
  }
  function setActiveMixer(id) {
    var d = getDevice(id);
    if (!d || d.type !== 'mixer') return;
    if (!d.mixer) d.mixer = defaultMixerFor(d);
    state.activeMixerId = id;
    save({ noHistory: true });   /* 翻页不产生撤销步骤 */
  }

  /* ---------- 调音台路由 ---------- */

  function mainTargets() {
    var m = M();
    var ids = mainIds(m);
    return ids.map(function (id, i) {
      var label;
      if (m.mains === 1 && m.mainMode === 'Mono') label = 'MAIN M';
      else if (m.mains === 2 && m.mainMode === 'LR') label = i === 0 ? 'MAIN L' : 'MAIN R';
      else label = 'MAIN ' + (i + 1);
      return { id: id, label: label };
    });
  }

  function chRoutes(ci) { return M().routes[ci] || []; }

  function hasRoute(ci, target) { return chRoutes(ci).indexOf(target) >= 0; }

  function toggleRoute(ci, target) {
    var r = M().routes[ci] || (M().routes[ci] = []);
    var idx = r.indexOf(target);
    if (idx >= 0) r.splice(idx, 1); else r.push(target);
    if (!r.length) delete M().routes[ci];
    save();
  }

  function setMixerConfig(cfg) {
    Object.assign(M(), cfg);
    var m = M();
    if (m.mains === undefined || m.mains === null) m.mains = m.mainMode === 'Mono' ? 1 : 2;
    m.mains = Math.max(0, Math.min(64, +m.mains || 0));
    Object.keys(m.routes).forEach(function (ci) {
      if (+ci >= m.channels) { delete m.routes[ci]; return; }
      var seen = {};
      m.routes[ci] = m.routes[ci].map(normalizeTargetId).filter(function (t) {
        if (!validTarget(m, t) || seen[t]) return false;
        seen[t] = true;
        return true;
      });
      if (!m.routes[ci].length) delete m.routes[ci];
    });
    m.links = (m.links || []).filter(function (ci) {
      return ci % 2 === 0 && ci + 1 < m.channels;
    });
    /* 输入分配：键 < 物理输入数，目标 < 通道数 */
    var ip = {};
    Object.keys(m.inPatch || {}).forEach(function (k) {
      if (+k >= m.physIn) return;
      var arr = (m.inPatch[k] || []).filter(function (c) { return c < m.channels; });
      if (arr.length) ip[k] = arr;
    });
    m.inPatch = ip;
    /* 输出分配：来源仍然存在，目标 < 物理输出数 */
    var op = {};
    Object.keys(m.outPatch || {}).forEach(function (sid) {
      sid = normalizeTargetId(sid);
      if (!validTarget(m, sid)) return;
      var arr = (m.outPatch[sid] || []).filter(function (o) { return o < m.physOut; });
      if (arr.length) op[sid] = arr;
    });
    m.outPatch = op;
    save();
  }

  /* ---------- 输入分配（IN → CH）/ 输出分配（BUS/MTX/MAIN → OUT） ---------- */

  function toggleInPatch(inIdx, chIdx) {
    var m = M();
    if (!m.inPatch) normalizeMixer(m);
    var r = m.inPatch[inIdx] || (m.inPatch[inIdx] = []);
    var i = r.indexOf(chIdx);
    if (i >= 0) r.splice(i, 1); else r.push(chIdx);
    if (!r.length) delete m.inPatch[inIdx];
    save();
  }
  function hasInPatch(inIdx, chIdx) {
    var m = M();
    if (!m.inPatch) normalizeMixer(m);
    var r = m.inPatch[inIdx];
    return !!r && r.indexOf(chIdx) >= 0;
  }
  function resetInPatch() {
    var m = M();
    m.inPatch = {};
    var n = Math.min(m.physIn, m.channels);
    for (var i = 0; i < n; i++) m.inPatch[i] = [i];
    save();
  }
  function doubleInPatch() {
    var m = M();
    m.inPatch = {};
    for (var i = 0; i < m.physIn; i++) {
      var a = i * 2, b = a + 1;
      var arr = [];
      if (a < m.channels) arr.push(a);
      if (b < m.channels) arr.push(b);
      if (arr.length) m.inPatch[i] = arr;
    }
    save();
  }
  /* 输入分配是否为标准 1:1 直通 */
  function inPatchIsIdentity() {
    var m = M();
    var n = Math.min(m.physIn, m.channels);
    var keys = Object.keys(m.inPatch);
    if (keys.length !== n) return false;
    for (var i = 0; i < n; i++) {
      var r = m.inPatch[i];
      if (!r || r.length !== 1 || r[0] !== i) return false;
    }
    return true;
  }

  function toggleOutPatch(sid, outIdx) {
    var m = M();
    var r = m.outPatch[sid] || (m.outPatch[sid] = []);
    var i = r.indexOf(outIdx);
    if (i >= 0) r.splice(i, 1); else r.push(outIdx);
    if (!r.length) delete m.outPatch[sid];
    save();
  }
  function hasOutPatch(sid, outIdx) {
    var r = M().outPatch[sid];
    return !!r && r.indexOf(outIdx) >= 0;
  }
  function outPatchSources() {
    var m = M();
    var out = [];
    for (var b = 0; b < m.buses; b++) out.push({ id: 'b' + b, grp: 'bus', label: 'BUS ' + (b + 1) });
    mainTargets().forEach(function (t) {
      out.push({ id: t.id, grp: 'main', label: t.label });
    });
    for (var x = 0; x < m.matrices; x++) out.push({ id: 'x' + x, grp: 'mtx', label: 'MATRIX ' + (x + 1) });
    return out;
  }

  /* ---------- CH 立体声链接（相邻奇偶对：1-2、3-4…，存偶数下标锚点） ---------- */

  /* 返回该通道所属链接对的锚点下标；未链接返回 null */
  function linkAnchor(ci) {
    var L = M().links;
    if (L.indexOf(ci) >= 0) return ci;
    if (ci % 2 === 1 && L.indexOf(ci - 1) >= 0) return ci - 1;
    return null;
  }

  function toggleLink(ci) {
    if (ci % 2 !== 0 || ci + 1 >= M().channels) return;
    var L = M().links;
    var i = L.indexOf(ci);
    if (i >= 0) {
      L.splice(i, 1);
    } else {
      L.push(ci);
      /* 合并两个通道已有的路由到锚点通道 */
      var a = M().routes[ci] || [];
      var b = M().routes[ci + 1] || [];
      var merged = a.slice();
      b.forEach(function (t) { if (merged.indexOf(t) < 0) merged.push(t); });
      if (merged.length) M().routes[ci] = merged;
      else delete M().routes[ci];
      delete M().routes[ci + 1];
    }
    save();
  }

  /* ---------- 用户自定义台内路由模板 ---------- */

  function saveMixerTemplate(name) {
    /* 整套台面：配置 + 路由 + 链接 + 输入/输出分配 */
    var t = JSON.parse(JSON.stringify(M()));
    t.name = name;
    state.userMixerTemplates.push(t);
    save();
  }

  function applyMixerTemplate(t) {
    var copy = JSON.parse(JSON.stringify(t));
    delete copy.name;
    /* 旧版模板缺少的字段用默认值补齐 */
    if (!copy.inPatch) copy.inPatch = null;
    setMixerData(normalizeMixer(Object.assign(defaultMixer(), copy)));
    save();
  }

  function removeMixerTemplate(idx) {
    state.userMixerTemplates.splice(idx, 1);
    save();
  }

  /* ---------- 整体替换（导入 / 示例 / 清空） ---------- */

  function replaceState(next, opt) {
    opt = opt || {};
    state = Object.assign(defaultState(), next);
    if (!Object.prototype.hasOwnProperty.call(next || {}, 'defaultShowRosterVersion')) state.defaultShowRosterVersion = 0;
    if (!Object.prototype.hasOwnProperty.call(next || {}, 'defaultStageMascotVersion')) state.defaultStageMascotVersion = 0;
    state.mixer = Object.assign(defaultMixer(), state.mixer || {});
    normalize(state);
    save({ noHistory: !!opt.noHistory, skipConfig: !!opt.skipConfig });
    if (opt.resetHistory) resetHistory();
  }

  return {
    get state() { return state; },
    firstRun: firstRun,
    save: save,
    batch: batch,
    quickLayout: quickLayout,
    reverseLayout: reverseLayout,
    reverseCalc: reverseCalc,
    ampPairMode: ampPairMode,
    setAmpPairMode: setAmpPairMode,
    isHiddenOut: isHiddenOut,
    visibleOuts: visibleOuts,
    outLabelOf: outLabelOf,
    portConn: portConn,
    setPortConn: setPortConn,
    templateInstances: templateInstances,
    syncTemplateInstances: syncTemplateInstances,
    cableSummary: cableSummary,
    rackSummary: rackSummary,
    powerSummary: powerSummary,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    undoArea: undoArea,
    redoArea: redoArea,
    canUndoArea: canUndoArea,
    canRedoArea: canRedoArea,
    resetHistory: resetHistory,
    typeInfo: typeInfo,
    addCustomType: addCustomType,
    addDevice: addDevice,
    addDevices: addDevices,
    getDevice: getDevice,
    removeDevice: removeDevice,
    removeDevices: removeDevices,
    clearAllDevices: clearAllDevices,
    ensureDspRoute: ensureDspRoute,
    hasDspRoute: hasDspRoute,
    toggleDspRoute: toggleDspRoute,
    setDspLimit: setDspLimit,
    addQuickPreset: addQuickPreset,
    removeQuickPreset: removeQuickPreset,
    addReversePreset: addReversePreset,
    removeReversePreset: removeReversePreset,
    baseNameOf: baseNameOf,
    saveDeviceAsTemplate: saveDeviceAsTemplate,
    saveAllTemplates: saveAllTemplates,
    exportTemplateLib: exportTemplateLib,
    importTemplateLib: importTemplateLib,
    mergeTemplate: mergeTemplate,
    clearDeviceConnections: clearDeviceConnections,
    moveDevice: moveDevice,
    cloneDevice: cloneDevice,
    numberedNames: numberedNames,
    smartAssign: smartAssign,
    smartAssignAll: smartAssignAll,
    parallelGroupOf: parallelGroupOf,
    clearAllConnections: clearAllConnections,
    smartAssignPreview: smartAssignPreview,
    addDeviceTemplate: addDeviceTemplate,
    updateDeviceTemplate: updateDeviceTemplate,
    removeDeviceTemplate: removeDeviceTemplate,
    resizeDevice: resizeDevice,
    signalOf: signalOf,
    speakerPowered: speakerPowered,
    signalName: signalName,
    sourceFor: sourceFor,
    consumersOf: consumersOf,
    connect: connect,
    disconnect: disconnect,
    isNetConn: isNetConn,
    danteList: danteList,
    isDante: isDante,
    toggleDante: toggleDante,
    setDante: setDante,
    setDanteAll: setDanteAll,
    netLinksOf: netLinksOf,
    netLinkBetween: netLinkBetween,
    freeNetPort: freeNetPort,
    setSwitchPorts: setSwitchPorts,
    addNetLink: addNetLink,
    removeNetLink: removeNetLink,
    connWarning: connWarning,
    connectionError: connectionError,
    cleanupConnectionErrors: cleanupConnectionErrors,
    powerAlarmModes: POWER_ALARM_MODES,
    setPowerAlarmMode: setPowerAlarmMode,
    powerAlarmResults: powerAlarmResults,
    powerAlarmForOutput: powerAlarmForOutput,
    ampImpedanceFactor: ampImpedanceFactor,
    ampEffectivePower: ampEffectivePower,
    ampEffectivePowerFromSpecs: ampEffectivePowerFromSpecs,
    ampRatedEquivalentPower: ampRatedEquivalentPower,
    ampRatedOhm: ampRatedOhm,
    ampLoadSummary: ampLoadSummary,
    pickAmpTemplate: pickAmpTemplate,
    cableOf: cableOf,
    colorOf: colorOf,
    isSpeakerRun: isSpeakerRun,
    gearById: gearById,
    setGearPatch: setGearPatch,
    addGear: addGear,
    removeGear: removeGear,
    performerTemplateById: performerTemplateById,
    showPerformerById: showPerformerById,
    standbyRosterById: standbyRosterById,
    addPerformerTemplate: addPerformerTemplate,
    duplicatePerformerTemplate: duplicatePerformerTemplate,
    removePerformerTemplate: removePerformerTemplate,
    addPerformerSource: addPerformerSource,
    removePerformerSource: removePerformerSource,
    addPerformerOutput: addPerformerOutput,
    removePerformerOutput: removePerformerOutput,
    addShowPerformer: addShowPerformer,
    addShowPerformerRecord: addShowPerformerRecord,
    removeShowPerformer: removeShowPerformer,
    removeShowPerformersByTemplate: removeShowPerformersByTemplate,
    createStandbyRosters: createStandbyRosters,
    duplicateStandbyRoster: duplicateStandbyRoster,
    removeStandbyRoster: removeStandbyRoster,
    addStandbyPerformer: addStandbyPerformer,
    duplicateStandbyMembers: duplicateStandbyMembers,
    removeStandbyMembers: removeStandbyMembers,
    syncPerformerTemplate: syncPerformerTemplate,
    performerPlacementCounts: performerPlacementCounts,
    isPlannedDoublePatch: isPlannedDoublePatch,
    setPlannedDoublePatch: setPlannedDoublePatch,
    calculateMixerPlan: calculateMixerPlan,
    stageBoxSuggestion: stageBoxSuggestion,
    syncRosterToTeaching: syncRosterToTeaching,
    applyMixerPlan: applyMixerPlan,
    activeMixer: M,
    activeMixerDev: activeMixerDev,
    mixerDevices: mixerDevices,
    setActiveMixer: setActiveMixer,
    mainTargets: mainTargets,
    chRoutes: chRoutes,
    hasRoute: hasRoute,
    toggleRoute: toggleRoute,
    setMixerConfig: setMixerConfig,
    toggleInPatch: toggleInPatch,
    hasInPatch: hasInPatch,
    resetInPatch: resetInPatch,
    doubleInPatch: doubleInPatch,
    inPatchIsIdentity: inPatchIsIdentity,
    toggleOutPatch: toggleOutPatch,
    hasOutPatch: hasOutPatch,
    outPatchSources: outPatchSources,
    linkAnchor: linkAnchor,
    toggleLink: toggleLink,
    saveMixerTemplate: saveMixerTemplate,
    applyMixerTemplate: applyMixerTemplate,
    removeMixerTemplate: removeMixerTemplate,
    replaceState: replaceState,
    defaultState: defaultState
  };
})();
