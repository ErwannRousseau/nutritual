import { expect, mock, test } from "bun:test";

const deviceKey = "nutritual.phone.device";
const deviceId = "123e4567-e89b-42d3-a456-426614174000";
const deviceSecret = "123e4567-e89b-42d3-b456-426614174001";
let storedValue: string | null = null;
let readError: Error | undefined;
let writeError: Error | undefined;
let writes: { key: string; value: string }[] = [];
let uuids = [deviceId, deviceSecret];

mock.module("expo-secure-store", () => ({
  getItemAsync: async () => {
    if (readError) throw readError;

    return storedValue;
  },
  setItemAsync: async (key: string, value: string) => {
    if (writeError) throw writeError;

    writes.push({ key, value });
    storedValue = value;
  },
  deleteItemAsync: async () => {
    storedValue = null;
  },
}));

mock.module("expo-crypto", () => ({ randomUUID: () => uuids.shift() }));

async function getCredentials() {
  return (await import("../device-credentials")).getDeviceCredentials();
}

function reset() {
  storedValue = null;
  readError = undefined;
  writeError = undefined;
  writes = [];
  uuids = [deviceId, deviceSecret];
}

test("reuses valid saved device credentials without rewriting them", async () => {
  reset();
  storedValue = JSON.stringify({ deviceId, deviceSecret });

  expect(await getCredentials()).toEqual({ deviceId, deviceSecret });
  expect(writes).toEqual([]);
});

test("regenerates credentials when saved JSON is malformed", async () => {
  reset();
  storedValue = "{";

  expect(await getCredentials()).toEqual({ deviceId, deviceSecret });
  expect(writes).toEqual([{ key: deviceKey, value: JSON.stringify({ deviceId, deviceSecret }) }]);
});

test.each([
  null,
  [],
  {},
  { deviceId: 123, deviceSecret },
  { deviceId: "invalid", deviceSecret },
  { deviceId, deviceSecret: "invalid" },
  { deviceId: "00000000-0000-0000-0000-000000000000", deviceSecret },
  { deviceId, deviceSecret: "ffffffff-ffff-ffff-ffff-ffffffffffff" },
  { deviceId: "123e4567-e89b-12d3-a456-426614174000", deviceSecret },
])("regenerates credentials when saved fields are invalid: %j", async (saved) => {
  reset();
  storedValue = JSON.stringify(saved);

  expect(await getCredentials()).toEqual({ deviceId, deviceSecret });
  expect(writes).toEqual([{ key: deviceKey, value: JSON.stringify({ deviceId, deviceSecret }) }]);
});

test("preserves SecureStore read failures", async () => {
  reset();
  readError = new Error("read failed");

  await expect(getCredentials()).rejects.toBe(readError);
  expect(writes).toEqual([]);
});

test("preserves SecureStore write failures", async () => {
  reset();
  storedValue = JSON.stringify({});
  writeError = new Error("write failed");

  await expect(getCredentials()).rejects.toBe(writeError);
});
