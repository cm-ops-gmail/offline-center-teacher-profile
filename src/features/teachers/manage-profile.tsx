'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, ImagePlus, LoaderCircle, UserRoundCog } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@tenminuteschool/design-system';
import { Monogram } from '@/components/ui/primitives';
import { useRatingsData } from '@/features/ratings/filters';
import type { Teacher } from '@/features/ratings/types';

/** Shrinks the picked photo to a 512px square JPEG (centre-cropped): small uploads, tidy avatars. */
async function squarePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('Use a JPG, PNG or WebP photo.');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const side = Math.min(bmp.width, bmp.height);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, S, S);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not prepare this photo. Try another image.');
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

interface FormState {
  name: string;
  designation: string;
  email: string;
  phone: string;
  years: string;
  status: 'active' | 'inactive';
  address: string;
}

const EMPTY: FormState = { name: '', designation: '', email: '', phone: '', years: '', status: 'active', address: '' };

/** The "Manage profile" action on a teacher's page: edit the details a program manager keeps for them. */
export function ManageProfile({ teacher }: { teacher: Teacher }) {
  const { refresh } = useRatingsData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed the form from the saved profile every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const p = teacher.profile;
    setForm(p ? { name: p.name || teacher.name, designation: p.designation, email: p.email, phone: p.phone, years: p.yearsOfExperience == null ? '' : String(p.yearsOfExperience), status: p.status, address: p.address } : { ...EMPTY, name: teacher.name });
    setPhoto(null);
    setPreview(null);
    setError(null);
  }, [open, teacher]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      setError(null);
      const small = await squarePhoto(file);
      setPhoto(small);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(small);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that photo.');
    }
  };

  const set = (key: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const save = async () => {
    setError(null);
    if (!form.name.trim()) return setError('Name cannot be empty.');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('That email address does not look right.');
    if (form.years && !/^\d+(\.\d+)?$/.test(form.years.trim())) return setError('Years of experience must be a number.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('name', form.name);
      fd.set('designation', form.designation);
      fd.set('email', form.email);
      fd.set('phone', form.phone);
      fd.set('yearsOfExperience', form.years.trim());
      fd.set('status', form.status);
      fd.set('address', form.address);
      if (photo) fd.set('image', photo);
      const res = await fetch(`/api/teachers/${teacher.id}`, { method: 'POST', body: fd });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not save the profile.');
      await refresh();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the profile.');
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
          <DialogDescription>Update {teacher.name}&rsquo;s details. These are kept for the profile only — their ratings stay attached.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Monogram name={form.name || teacher.name} src={preview ?? teacher.profile?.imageUrl ?? null} size="lg" />
            <div className="flex flex-col gap-1.5">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? undefined)} />
              <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" /> {teacher.profile?.imageUrl || preview ? 'Replace photo' : 'Upload photo'}
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or WebP — cropped to a square.</p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mp-name">Name</Label>
            <Input id="mp-name" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder={teacher.name} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="mp-designation">Designation</Label>
            <Input id="mp-designation" value={form.designation} onChange={(e) => set('designation')(e.target.value)} placeholder="e.g. Senior Instructor" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="mp-email">Email</Label>
              <Input id="mp-email" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mp-phone">Phone</Label>
              <Input id="mp-phone" type="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="+880 …" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="mp-years">Years of experience</Label>
              <Input id="mp-years" inputMode="decimal" value={form.years} onChange={(e) => set('years')(e.target.value)} placeholder="e.g. 5" />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v === 'inactive' ? 'inactive' : 'active' }))}>
                <SelectTrigger id="mp-status" className="w-full">
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
            <Label htmlFor="mp-address">Address</Label>
            <Textarea id="mp-address" value={form.address} onChange={(e) => set('address')(e.target.value)} placeholder="Street, city" className="min-h-20" />
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
