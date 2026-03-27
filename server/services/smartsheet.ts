import axios from 'axios';
import { wecomConfig } from '../config/wecom';
import { getAccessToken } from './wecom';

const API = wecomConfig.apiBase;

// ── 创建新文档/智能表格 ─────────────────────────────────────────
export async function createDoc(docName: string, docType: number = 4, adminUsers?: string[]) {
  const token = await getAccessToken();
  const body: any = { doc_type: docType, doc_name: docName };
  if (adminUsers?.length) body.admin_users = adminUsers;
  
  const res = await axios.post(`${API}/wedoc/create_doc?access_token=${token}`, body);
  if (res.data.errcode !== 0) {
    throw new Error(`创建文档失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return { docid: res.data.docid, url: res.data.url };
}

// ── 查询智能表格子表列表 ─────────────────────────────────────────
export async function getSheets(docid: string) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/get_sheet?access_token=${token}`, { docid });
  if (res.data.errcode !== 0) {
    throw new Error(`查询子表失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.sheet_list || [];
}

// ── 添加字段 ──────────────────────────────────────────────────
export async function addFields(docid: string, sheetId: string, fields: any[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/add_fields?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    fields,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`添加字段失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.fields || [];
}

// ── 获取智能表格字段列表 ────────────────────────────────────────
export async function getSheetFields(docid: string, sheetId: string) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/get_fields?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`获取字段失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.fields || [];
}

// ── 查询记录 ──────────────────────────────────────────────────
export async function getRecords(docid: string, sheetId: string, opts?: { offset?: number; limit?: number; viewId?: string }) {
  const token = await getAccessToken();
  const body: any = { docid, sheet_id: sheetId };
  if (opts?.offset) body.offset = opts.offset;
  if (opts?.limit) body.limit = opts.limit;
  if (opts?.viewId) body.view_id = opts.viewId;
  // Use field title as key for readability
  body.key_type = 'CELL_VALUE_KEY_TYPE_FIELD_TITLE';

  const res = await axios.post(`${API}/wedoc/smartsheet/get_records?access_token=${token}`, body);
  if (res.data.errcode !== 0) {
    throw new Error(`查询记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return {
    records: res.data.records || [],
    total: res.data.total || 0,
    has_more: res.data.has_more || false,
  };
}

// ── 添加记录 ──────────────────────────────────────────────────
export async function addRecords(docid: string, sheetId: string, records: any[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/add_records?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    key_type: 'CELL_VALUE_KEY_TYPE_FIELD_TITLE',
    records,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`添加记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.records || [];
}

// ── 更新记录 ──────────────────────────────────────────────────
export async function updateRecords(docid: string, sheetId: string, records: any[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/update_records?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    key_type: 'CELL_VALUE_KEY_TYPE_FIELD_TITLE',
    records,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`更新记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.records || [];
}

// ── 删除记录 ──────────────────────────────────────────────────
export async function deleteRecords(docid: string, sheetId: string, recordIds: string[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/delete_records?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    record_ids: recordIds,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`删除记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return true;
}
