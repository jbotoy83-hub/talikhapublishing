import { PrototypeAdminPanel } from "../../../admin-panel/src/main";
import { getAdminUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Publisher admin"
};

export default async function AdminPage() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return <PrototypeAdminPanel accessRole={user.role} />;
}
