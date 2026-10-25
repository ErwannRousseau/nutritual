export {};

const email = process.env.AUTH_PROVISION_EMAIL;
const password = process.env.AUTH_PROVISION_PASSWORD;

if (!email || !password) {
  console.error("Auth provisioning failed: temporary account credentials are not set.");
  process.exitCode = 1;
} else {
  const { createProvisioningAuth, database } = await import("./auth.ts");

  try {
    const existingAccount = await database.query('SELECT 1 FROM "user" LIMIT 1');

    if (existingAccount.rowCount) throw new Error();

    const result = await createProvisioningAuth().api.signUpEmail({
      body: { email, password, name: "Nutritual user" },
    });

    if (!result.user.id) throw new Error();

    console.log("Nutritual account provisioned.");
  } catch {
    console.error("Auth provisioning failed: account could not be created.");
    process.exitCode = 1;
  } finally {
    await database.end().catch(() => {
      process.exitCode = 1;
    });
  }
}
