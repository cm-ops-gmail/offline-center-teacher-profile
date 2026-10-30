'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, ImagePlus, LoaderCircle, UserRoundCog } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@tenminuteschool/design-system';
import { Monogram } from '@/components/ui/primitives';
import { squarePhoto } from '@/features/teachers/manage-profile';
import { saveOnlineProfile, type OnlineTeacher } from './data';

/**
 * Manage profile for an online teacher. The app is demo-only in this segment for now,
 * so the details are saved on this device (localStorage) instead of the database.
 */
export function ManageOnlineProfile({ teacher }: { teacher: OnlineTeacher }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', designation: '', email: '', phone: '', years: '', status: 'active', address: '' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: teacher.name,
      designation: teacher.designation,
      email: teacher.email,
      phone: teacher.phone,
      years: String(teacher.yearsOfExperience),
      status: teacher.status,
      address: teacher.address,
    });
    setPhoto(teacher.photo);
    setError(null);
  }, [open, teacher]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setError(null);
      const small = await squarePhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhoto(String(reader.result));
      reader.readAsDataURL(small);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo.');
    }
  };

  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const save = async () => {
    setError(null);
    if (!form.name.trim()) return setError('Name cannot be empty.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('That email address does not look right.');
    if (form.years && !/^\d+(\.\d+)?$/.test(form.years.trim())) return setError('Years of experience must be a number.');
    setBusy(true);
    try {
      saveOnlineProfile(teacher.id, {
        name: form.name.trim(),
        designation: form.designation.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        yearsOfExperience: form.years.trim() === '' ? teacher.yearsOfExperience : Number(form.years),
        status: form.status === 'inactive' ? 'inactive' : 'active',
        address: form.address.trim(),
        photo,
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserRoundCog className="size-4" /> Manage profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage profile</DialogTitle>
          <DialogDescription>Update {teacher.name}&rsquo;s details. The online segment is a demo for now — changes are saved on this device.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Monogram name={form.name || teacher.name} src={photo} size="lg" />
            <div className="flex flex-col gap-1.5">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
              <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" /> {photo ? 'Replace photo' : 'Upload photo'}
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or WebP — cropped to a square.</p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="op-name">Name</Label>
            <Input id="op-name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="op-designation">Designation</Label>
            <Input id="op-designation" value={form.designation} onChange={(e) => set('designation')(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="op-email">Email</Label>
              <Input id="op-email" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="op-phone">Phone</Label>
              <Input id="op-phone" type="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="op-years">Years of experience</Label>
              <Input id="op-years" inputMode="decimal" value={form.years} onChange={(e) => set('years')(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger id="op-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="op-address">Address</Label>
            <Textarea id="op-address" value={form.address} onChange={(e) => set('address')(e.target.value)} className="min-h-20" />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-critical">
              <CircleAlert className="size-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy && <LoaderCircle className="size-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
