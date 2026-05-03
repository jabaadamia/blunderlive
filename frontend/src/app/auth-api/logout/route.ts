import { NextRequest, NextResponse } from "next/server";

import {
  applyRefreshCookie,
  clearRefreshCookie,
  postToCoreAuth,
} from "@/features/auth/server/route-utils";

export async function POST(request: NextRequest) {
  const refreshCookie = request.cookies.get("refresh")?.value;
  const { result, setCookieHeader } = await postToCoreAuth("logout/", {
    refreshCookie,
  });

  const response = NextResponse.json(result);

  if (setCookieHeader) {
    applyRefreshCookie(response, setCookieHeader);
  } else {
    clearRefreshCookie(response);
  }

  return response;
}
