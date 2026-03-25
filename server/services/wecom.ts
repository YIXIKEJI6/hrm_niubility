import axios from 'axios';
import { wecomConfig } from '../config/wecom';

// ── 自建应用 Token（用于 OAuth 登录）────────────────────────────
let accessToken: string = '';
let tokenExpiry: number = 0;

export async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const url = `${wecomConfig.apiBase}/gettoken?corpid=${wecomConfig.corpId}&corpsecret=${wecomConfig.secret}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取access_token失败: ${res.data.errmsg}`);
  }

  accessToken = res.data.access_token;
  tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
  return accessToken;
}

// ── 通讯录同步 Token（用于部门/成员接口）──────────────────────────
let contactToken: string = '';
let contactTokenExpiry: number = 0;

export async function getContactAccessToken(): Promise<string> {
  // 如果没有配置通讯录 Secret，降级使用应用 Secret
  const secret = wecomConfig.contactSecret || wecomConfig.secret;

  if (contactToken && Date.now() < contactTokenExpiry) {
    return contactToken;
  }

  const url = `${wecomConfig.apiBase}/gettoken?corpid=${wecomConfig.corpId}&corpsecret=${secret}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取通讯录access_token失败: ${res.data.errmsg} (errcode: ${res.data.errcode})`);
  }

  contactToken = res.data.access_token;
  contactTokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000;
  return contactToken;
}

// OAuth: 用 code 换取用户身份
export async function getUserIdByCode(code: string): Promise<{ userId: string }> {
  const token = await getAccessToken();
  const url = `${wecomConfig.apiBase}/auth/getuserinfo?access_token=${token}&code=${code}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取用户身份失败: ${res.data.errmsg}`);
  }

  return { userId: res.data.userid || res.data.UserId };
}

// 获取部门列表（使用通讯录 token）
export async function getDepartmentList(): Promise<any[]> {
  const token = await getContactAccessToken();
  // 显式传 id=1 (根部门) 确保返回完整部门树
  const url = `${wecomConfig.apiBase}/department/list?access_token=${token}&id=1`;
  const res = await axios.get(url);

  console.log('[WeCom] department/list response:', JSON.stringify(res.data).slice(0, 500));

  if (res.data.errcode !== 0) {
    throw new Error(`获取部门列表失败: ${res.data.errmsg} (errcode: ${res.data.errcode})`);
  }

  return res.data.department || [];
}

// 获取部门成员详情（使用通讯录 token）
export async function getDepartmentMembers(departmentId: number): Promise<any[]> {
  const token = await getContactAccessToken();
  const url = `${wecomConfig.apiBase}/user/list?access_token=${token}&department_id=${departmentId}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取部门成员失败: ${res.data.errmsg} (errcode: ${res.data.errcode})`);
  }

  return res.data.userlist || [];
}

// 获取用户详情
export async function getUserDetail(userId: string): Promise<any> {
  const token = await getContactAccessToken();
  const url = `${wecomConfig.apiBase}/user/get?access_token=${token}&userid=${userId}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取用户详情失败: ${res.data.errmsg}`);
  }

  return res.data;
}
