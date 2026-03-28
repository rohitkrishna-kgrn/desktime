'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getStoredUser } from '../../../lib/auth';
import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment, getUsers,
} from '../../../lib/api';
import Navbar from '../../../components/Navbar';

function DeptModal({ dept, employees, onClose, onSaved }) {
  const isEdit = !!dept;
  const [name, setName]         = useState(dept?.name || '');
  const [description, setDesc]  = useState(dept?.description || '');
  const [managerId, setMgr]     = useState(dept?.managerId?._id || dept?.managerId || '');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await updateDepartment(dept._id, { name: name.trim(), description, managerId: managerId || null });
      } else {
        await createDepartment({ name: name.trim(), description, managerId: managerId || null });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          {isEdit ? 'Edit Department' : 'New Department'}
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Department Manager</label>
            <select
              value={managerId}
              onChange={(e) => setMgr(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">No manager</option>
              {employees.map((u) => (
                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">Selected user will be promoted to Manager role.</p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirm({ dept, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteDepartment(dept._id);
      onDeleted();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <h2 className="mb-2 text-base font-semibold text-slate-900">Delete Department</h2>
        <p className="mb-4 text-sm text-slate-500">
          Remove <span className="font-medium text-slate-800">{dept.name}</span>? Members will be unassigned.
        </p>
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepts]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editDept, setEditDept]   = useState(null);
  const [deleteDept, setDeleteDept] = useState(null);
  const [showNew, setShowNew]     = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    const me = getStoredUser();
    if (me?.role !== 'admin') { router.replace('/dashboard'); return; }
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [depts, users] = await Promise.all([getDepartments(), getUsers()]);
      setDepts(depts);
      setEmployees(users);
    } catch {} finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />

      {showNew && (
        <DeptModal employees={employees} onClose={() => setShowNew(false)} onSaved={fetchAll} />
      )}
      {editDept && (
        <DeptModal dept={editDept} employees={employees} onClose={() => setEditDept(null)} onSaved={fetchAll} />
      )}
      {deleteDept && (
        <DeleteConfirm dept={deleteDept} onClose={() => setDeleteDept(null)} onDeleted={fetchAll} />
      )}

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Departments</h1>
              <p className="text-sm text-slate-500">{departments.length} department{departments.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Department
          </button>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {loading ? (
            <div className="space-y-px p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <svg className="mb-3 h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-sm">No departments yet. Create one to get started.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Department</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:table-cell">Manager</th>
                  <th className="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">Members</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {departments.map((d) => {
                  const memberCount = employees.filter(
                    (u) => (u.departmentId?._id || u.departmentId) === d._id ||
                           String(u.departmentId?._id || u.departmentId) === String(d._id)
                  ).length;
                  return (
                    <tr key={d._id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-800">{d.name}</p>
                        {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                      </td>
                      <td className="hidden px-5 py-3.5 sm:table-cell">
                        {d.managerId ? (
                          <div>
                            <p className="font-medium text-slate-700">{d.managerId.name}</p>
                            <p className="text-xs text-slate-400">{d.managerId.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-300">No manager</span>
                        )}
                      </td>
                      <td className="hidden px-5 py-3.5 text-slate-500 md:table-cell">
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditDept(d)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteDept(d)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
