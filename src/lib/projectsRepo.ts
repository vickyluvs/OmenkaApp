import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { ScriptProject } from "./types";

const colRef = (uid: string) => collection(db, "users", uid, "projects");

export async function listProjects(uid: string) {
  const q = query(colRef(uid), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ScriptProject);
}

export async function upsertProject(uid: string, project: ScriptProject) {
  await setDoc(
    doc(db, "users", uid, "projects", project.id),
    { ...project, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function removeProject(uid: string, projectId: string) {
  await deleteDoc(doc(db, "users", uid, "projects", projectId));
}

export {};
