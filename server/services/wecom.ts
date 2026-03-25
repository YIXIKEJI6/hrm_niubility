import axios from 'axios';
import { wecomConfig } from '../config/wecom';

let accessToken: string = '';
let tokenExpiry: number = 0;

// 获取 access_token (带缓存)
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
  tokenExpiry = Date.now() + (res.data.expires_in - 300) * 1000; // 提前5分钟过期
  return accessToken;
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

// 获取部门列表
export async function getDepartmentList(): Promise<any[]> {
  const token = await getAccessToken();
  const url = `${wecomConfig.apiBase}/department/list?access_token=${token}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取部门列表失败: ${res.data.errmsg}`);
  }

  return res.data.department || [];
}

// 获取部门成员详情
export async function getDepartmentMembers(departmentId: number): Promise<any[]> {
  const token = await getAccessToken();
  const url = `${wecomConfig.apiBase}/user/list?access_token=${token}&department_id=${departmentId}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取部门成员失败: ${res.data.errmsg}`);
  }

  return res.data.userlist || [];
}

// 获取用户详情
export async function getUserDetail(userId: string): Promise<any> {
  const token = await getAccessToken();
  const url = `${wecomConfig.apiBase}/user/get?access_token=${token}&userid=${userId}`;
  const res = await axios.get(url);

  if (res.data.errcode !== 0) {
    throw new Error(`获取用户详情失败: ${res.data.errmsg}`);
  }

  return res.data;
}
