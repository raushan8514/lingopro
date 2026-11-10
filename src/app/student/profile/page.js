import { Mail, ShieldCheck, UserRound } from "lucide-react";
import {
  StudentAvatarUploader,
  StudentProfileForm,
} from "@/components/student/student-forms";
import { StudentPageHeader } from "@/components/student/student-components";
import { getStudentProfilePageData } from "@/lib/student/data";
import { Avatar } from "@/components/ui/indicators";

export const metadata = {
  title: "Student profile",
  robots: { index: false, follow: false },
};

export default async function StudentProfilePage() {
  const { identity, profile } = await getStudentProfilePageData();

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Your account"
        title="Profile"
        description="Manage the personal details shown in your learning workspace."
      />
      <div className="student-profile-layout">
        <section className="student-panel student-profile-identity">
          <div className="student-profile-avatar">
            <Avatar
              name={profile.full_name}
              src={profile.avatar_url}
              size="lg"
            />
          </div>
          <h2>{profile.full_name}</h2>
          <p>Student account</p>
          <StudentAvatarUploader
            studentId={identity.id}
            currentPath={profile.avatar_path}
          />
          {profile.avatar_unavailable && (
            <p className="student-form-message is-error" role="status">
              Your private profile image could not be loaded. Initials are shown instead.
            </p>
          )}
        </section>

        <section className="student-panel">
          <header className="student-panel-heading">
            <div>
              <p className="student-eyebrow">Personal information</p>
              <h2>Edit profile</h2>
            </div>
            <UserRound size={20} aria-hidden="true" />
          </header>
          <StudentProfileForm fullName={profile.full_name} />
        </section>
      </div>

      <section className="student-panel">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Verified account details</p>
            <h2>Sign-in and role</h2>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </header>
        <dl className="student-account-details">
          <div>
            <dt><Mail size={16} aria-hidden="true" /> Sign-in email</dt>
            <dd>{identity.email || "Email is not available"}</dd>
          </div>
          <div>
            <dt><ShieldCheck size={16} aria-hidden="true" /> Account role</dt>
            <dd>Student</dd>
          </div>
        </dl>
        <p className="student-data-note">
          Email changes and role changes are not available in the student workspace.
          Role assignment remains controlled by trusted platform operations.
        </p>
      </section>
    </div>
  );
}
