import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { InstructorProfileForm } from "@/components/instructor/instructor-forms";
import {
  InstructorPageHeader,
  InstructorPanel,
} from "@/components/instructor/instructor-components";
import { Avatar } from "@/components/ui/indicators";
import { getInstructorProfile } from "@/lib/instructor/data";

export const metadata = {
  title: "Instructor profile",
  robots: { index: false, follow: false },
};

export default async function InstructorProfilePage() {
  const { identity, profile } = await getInstructorProfile();
  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Your account"
        title="Instructor profile"
        description="Manage the identity shown in your instructor workspace."
      />
      <div className="instructor-profile-grid">
        <InstructorPanel eyebrow="Public identity" title={profile.full_name || "Instructor"}>
          <div className="instructor-profile-avatar" aria-hidden="true">
            {profile.avatar_url
              ? <Avatar name={profile.full_name} src={profile.avatar_url} size="lg" />
              : <UserRound size={32} />}
          </div>
          <p className="instructor-form-help">Profile details may be shown with your published courses.</p>
        </InstructorPanel>
        <InstructorPanel eyebrow="Profile details" title="Edit profile">
          <InstructorProfileForm profile={profile} />
        </InstructorPanel>
      </div>
      <InstructorPanel eyebrow="Verified account information" title="Sign-in and role">
        <dl className="instructor-account-details">
          <div><dt><Mail size={16} aria-hidden="true" /> Sign-in email</dt><dd>{identity.email || "Email is not available"}</dd></div>
          <div><dt><ShieldCheck size={16} aria-hidden="true" /> Account role</dt><dd>Instructor</dd></div>
        </dl>
        <p className="instructor-form-help">Email changes and role assignments are controlled by account-security and platform administration workflows.</p>
      </InstructorPanel>
    </div>
  );
}
