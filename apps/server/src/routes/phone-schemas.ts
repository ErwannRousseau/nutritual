import { z } from "zod";

const codePattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const idPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const secretPattern = /^[A-Za-z0-9_-]{32,256}$/;
export const codeRequestSchema = z.object({ code: z.string().regex(codePattern) });

export const approvalRequestSchema = z.object({
  code: z.string().regex(codePattern),
  deviceId: z.string().regex(idPattern),
  deviceSecret: z.string().regex(secretPattern),
});

export const deviceRequestSchema = z.object({
  deviceId: z.string().regex(idPattern),
  deviceSecret: z.string().regex(secretPattern),
});
