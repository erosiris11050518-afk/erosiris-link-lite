/* ErosIris-Link Lite 核心逻辑冒烟测试（JavaScriptCore） */
var _ls = {};
var window = this;
window.indexedDB = undefined;
var localStorage = {
  getItem: function (k) { return _ls.hasOwnProperty(k) ? _ls[k] : null; },
  setItem: function (k, v) { _ls[k] = String(v); },
  removeItem: function (k) { delete _ls[k]; }
};
window.localStorage = localStorage;
var document = {
  documentElement: { getAttribute: function () { return 'dark'; }, setAttribute: function () {} },
  getElementById: function () { return null; },
  addEventListener: function () {},
  createElement: function () { return { getContext: function () { return null; } }; },
  querySelectorAll: function () { return []; }
};
window.document = document;
var navigator = { platform: 'MacIntel' };
var alert = function () {};
var confirm = function () { return true; };
var setTimeout = function (fn) { fn(); return 0; };

load('js/db.js');
load('js/store.js');

var Store = SP.Store;
var pass = 0, fail = 0;
function T(name, ok) {
  if (ok) { pass++; print('  ✓ ' + name); }
  else { fail++; print('  ✗ ' + name); }
}

print('== Lite 核心规则 ==');
T('内置模板可用', Store.state.deviceTemplates.length >= 20);
T('音箱/功放/DSP/调音台模板齐全', ['speaker', 'amp', 'dsp', 'mixer'].every(function (type) {
  return Store.state.deviceTemplates.some(function (t) { return t.type === type; });
}));

var calc = Store.reverseCalc(
  [{ name: '测试全频', power: 500, ohms: 8, count: 4, parallel: 2 }],
  { ratio: 2, ampMode: '4', amp4W: 2500, minOhms: 4, dspOuts: 8 }
);
T('反推计算并联负载', calc.rows[0].loadOhm === 4 && calc.rows[0].ch === 2);
T('反推计算功率需求', calc.rows[0].needW === 1334 && calc.errors.length === 0);

Store.replaceState(Store.defaultState());
var mixerTpl = { type: 'mixer', name: '咨询调音台', ins: 16, outs: 8 };
var dspTpl = { type: 'dsp', name: '咨询DSP', ins: 4, outs: 8 };
var ampTpl = { type: 'amp', name: '咨询功放', ins: 4, outs: 4, specs: { power: '2500' } };
var speakerTpl = { type: 'speaker', name: '咨询全频', ins: 1, outs: 1,
  speakerRole: 'fullrange', specs: { powered: 'passive', power: '500', ohms: '8' } };
Store.reverseLayout({
  mixerTpl: mixerTpl, mixerCount: 1,
  dspTpl: dspTpl, dspCount: 1,
  amp4Tpl: ampTpl,
  speakerRows: [{ tpl: speakerTpl, count: 4, parallel: 2, a2: 0, a4: 1 }]
});
T('一键生成完整设备链', ['mixer', 'dsp', 'amp', 'speaker'].every(function (type) {
  return Store.state.devices.some(function (d) { return d.type === type; });
}));
T('一键生成连接关系', Store.state.connections.length >= 5);
T('线材汇总可生成', Store.cableSummary().length > 0);
T('配置可持久化', !!localStorage.getItem('signalpath-v2'));

print('\n结果：' + pass + ' 通过，' + fail + ' 失败');
if (fail) throw new Error('Lite 核心测试失败');
