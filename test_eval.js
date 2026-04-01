const item = { id: 11, title: '财务测试1', assignee_id: 'huangli' };
const r = item?.r || item?.assignee_id || '';
console.log(r);
