import axios from "axios";

export async function register(data: any) {
  return axios.post("/api/auth/register", data);
}