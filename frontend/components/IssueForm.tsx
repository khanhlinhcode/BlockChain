"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";
import { getFriendlyError } from "@/lib/errorMessages";
import { useLanguage } from "@/context/LanguageContext";

type IssueFormData = {
  recipientName: string;
  recipientEmail?: string;
  courseName: string;
  expiryDate?: string;
};

export default function IssueForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const issueSchema = useMemo(
    () =>
      z.object({
        recipientName: z.string().min(2, t("validation.nameMin")),
        recipientEmail: z.string().email(t("validation.invalidEmail")).optional().or(z.literal("")),
        courseName: z.string().min(2, t("validation.courseMin")),
        expiryDate: z.string().optional(),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const onSubmit = async (data: IssueFormData) => {
    if (!file) {
      setError(t("legacyIssue.fileRequired"));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("pdfFile", file);
      formData.append("recipientName", data.recipientName);
      formData.append("recipientEmail", data.recipientEmail || "");
      formData.append("courseName", data.courseName);
      if (data.expiryDate) {
        formData.append("expiryDate", data.expiryDate);
      }

      await api.issueCertificate(formData);
      setSuccess(true);

      setTimeout(() => {
        router.push("/admin/certificates");
      }, 2000);
    } catch (err: unknown) {
      setError(getFriendlyError(err, t("legacyIssue.failed")));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">
          {t("issue.successTitle")}
        </h2>
        <p className="text-muted-foreground">
          {t("legacyIssue.redirecting")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          {t("legacyIssue.fileLabel")}
        </label>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-blue-400 bg-blue-500/10"
              : file
              ? "border-green-400/30 bg-green-500/5"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <input {...getInputProps()} />
          <Upload
            className={`w-8 h-8 mx-auto mb-2 ${
              file ? "text-green-400" : "text-white/30"
            }`}
          />
          {file ? (
            <p className="text-green-400 text-sm font-medium">{file.name}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t("legacyIssue.dragDrop")}
            </p>
          )}
        </div>
      </div>

      {/* Recipient Name */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          {t("legacyIssue.recipientName")}
        </label>
        <input
          type="text"
          {...register("recipientName")}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          placeholder="e.g., Nguyen Van A"
        />
        {errors.recipientName && (
          <p className="text-red-400 text-xs mt-1">
            {errors.recipientName.message}
          </p>
        )}
      </div>

      {/* Recipient Email */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          {t("legacyIssue.recipientEmail")}
        </label>
        <input
          type="email"
          {...register("recipientEmail")}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          placeholder="e.g., student@example.com"
        />
        {errors.recipientEmail && (
          <p className="text-red-400 text-xs mt-1">
            {errors.recipientEmail.message}
          </p>
        )}
      </div>

      {/* Course Name */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          {t("issue.courseProgram")}
        </label>
        <input
          type="text"
          {...register("courseName")}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
          placeholder="e.g., Blockchain Development"
        />
        {errors.courseName && (
          <p className="text-red-400 text-xs mt-1">
            {errors.courseName.message}
          </p>
        )}
      </div>

      {/* Expiry Date */}
      <div>
        <label className="block text-sm font-medium text-white mb-2">
          {t("legacyIssue.expiryDate")}
        </label>
        <input
          type="date"
          {...register("expiryDate")}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            {t("legacyIssue.issuing")}
          </>
        ) : (
          t("admin.issueCertificate")
        )}
      </button>
    </form>
  );
}
