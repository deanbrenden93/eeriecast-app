import React from 'react';
import PropTypes from 'prop-types';
import LegalDocumentModal, {
  LegalSection,
  LegalSubheading,
  LegalList,
} from './LegalDocumentModal';

const LAST_UPDATED = 'April 22, 2026';

export default function PrivacyPolicyModal({ open, onOpenChange }) {
  return (
    <LegalDocumentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
    >
      <p className="text-[13.5px] leading-relaxed text-zinc-300 mb-6">
        Eeriecast is a horror podcast network dedicated to storytelling and folklore.
        This Privacy Policy describes how <strong>Eeriecast, LLC</strong>
        (&ldquo;Eeriecast,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and
        protects information when you use our mobile and web applications,
        website, and related services (collectively, the &ldquo;Service&rdquo;). By using
        the Service, you agree to the collection and use of information as
        described below.
      </p>

      <LegalSection number="1" title="Information We Collect">
        <LegalSubheading>Information You Provide</LegalSubheading>
        <LegalList>
          <li>
            <strong>Account details:</strong> email address, password (stored
            as a one-way hash), and your birth year (used to verify age for
            shows with explicit language).
          </li>
          <li>
            <strong>Profile details:</strong> display name, avatar, and optional
            biography, if you choose to provide them.
          </li>
          <li>
            <strong>Payment details:</strong> when you subscribe to Premium, you
            provide payment information directly to our payment processor
            (Stripe). We receive a limited token and the last four digits, card
            brand, and expiration date of your card, but not the full card
            number or CVC.
          </li>
          <li>
            <strong>Communications:</strong> messages you send us at{' '}
            <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
              brenden@eeriecast.com
            </a>{' '}
            or through the Service.
          </li>
        </LegalList>

        <LegalSubheading>Information We Collect Automatically</LegalSubheading>
        <LegalList>
          <li>
            <strong>Listening activity:</strong> episodes played, playback
            position, favorites, playlists, shows followed, and listening
            history. This powers features like &ldquo;Continue listening,&rdquo; statistics
            on your Profile, personalized recommendations, and show-follow
            notifications.
          </li>
          <li>
            <strong>Device and technical data:</strong> app version, operating
            system, approximate location derived from your IP address, and basic
            diagnostic information needed to operate the Service.
          </li>
          <li>
            <strong>Preferences:</strong> settings you configure, such as
            autoplay, playback speed, remember-position, notifications, and
            mature-content preferences.
          </li>
        </LegalList>

        <LegalSubheading>Information From Third Parties</LegalSubheading>
        <p>
          If you were migrated from our previous membership platform, we
          received basic account information (email, plan type, and
          subscription status) needed to establish your account and legacy free
          trial.
        </p>
      </LegalSection>

      <LegalSection number="2" title="How We Use Information">
        <LegalList>
          <li>Provide, operate, and maintain the Service;</li>
          <li>Authenticate you and keep your account secure;</li>
          <li>Process payments, manage subscriptions, and provide free trials;</li>
          <li>Personalize your experience, including recommendations, recent activity, and your top shows;</li>
          <li>Send notifications about new episodes from shows you follow, subject to your notification settings;</li>
          <li>Communicate with you about the Service, including subscription reminders and legal notices;</li>
          <li>Verify age and enforce mature-content restrictions;</li>
          <li>Monitor and protect the Service against fraud, abuse, and security threats;</li>
          <li>Comply with legal obligations.</li>
        </LegalList>
      </LegalSection>

      <LegalSection number="3" title="How We Share Information">
        <p>
          We do not sell your personal information. We share information only in
          the following limited circumstances:
        </p>
        <LegalList>
          <li>
            <strong>Service providers:</strong> trusted vendors that process data
            on our behalf under confidentiality and security obligations,
            including Stripe (payment processing), cloud hosting and content
            delivery providers, transactional email providers, and error
            monitoring tools.
          </li>
          <li>
            <strong>Legal and safety:</strong> when required to comply with a
            subpoena, court order, or other legal process, or when we believe in
            good faith that disclosure is necessary to protect the rights,
            property, or safety of Eeriecast, our users, or the public.
          </li>
          <li>
            <strong>Business transfers:</strong> if Eeriecast is involved in a
            merger, acquisition, or sale of assets, your information may be
            transferred as part of that transaction, subject to a continued
            privacy commitment.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number="4" title="Data Retention">
        <p>
          We retain your information for as long as your account is active or
          as needed to provide the Service. If you delete your account, we will
          delete or anonymize your personal information within a reasonable
          period, except where we must retain it to comply with legal
          obligations, resolve disputes, or enforce our agreements.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Your Choices and Rights">
        <LegalList>
          <li>
            <strong>Access and update:</strong> you can review and update your
            profile information from within the Service.
          </li>
          <li>
            <strong>Listening history:</strong> you can clear your listening
            history at any time from Settings &rarr; Privacy &amp; Content.
          </li>
          <li>
            <strong>Notifications:</strong> you can turn off new-episode
            notifications in Settings.
          </li>
          <li>
            <strong>Mature content:</strong> the mature-content toggle is only
            available if your verified age is 18 or older.
          </li>
          <li>
            <strong>Cancel subscription:</strong> you can cancel your Premium
            subscription at any time from Billing &amp; Subscription. Access
            remains until the end of your current billing period.
          </li>
          <li>
            <strong>Account deletion and data requests:</strong> to delete your
            account, request a copy of your data, or exercise any privacy rights
            available to you under applicable law, email{' '}
            <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
              brenden@eeriecast.com
            </a>.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection number="6" title="Security">
        <p>
          We apply reasonable administrative, technical, and physical safeguards
          to protect your information, including encryption in transit, hashed
          passwords, and restricted internal access. No method of transmission
          or storage is completely secure, however, and we cannot guarantee
          absolute security.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Children">
        <p>
          The Service is not directed to children under 13, and we do not
          knowingly collect personal information from children under 13. If you
          believe we have collected information from a child under 13, please
          contact{' '}
          <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
            brenden@eeriecast.com
          </a>{' '}
          and we will delete it. Certain content within the Service is further
          restricted to users 18 and older (see Explicit Language in our Terms
          of Service).
        </p>
      </LegalSection>

      <LegalSection number="8" title="International Users">
        <p>
          Eeriecast is operated from the United States. If you access the
          Service from outside the United States, your information will be
          transferred to and processed in the United States, which may have data
          protection laws that differ from those of your country.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Third-Party Links and Services">
        <p>
          The Service may contain links to third-party websites or rely on
          third-party services (for example, show websites or payment
          processors). We are not responsible for the privacy practices of
          those third parties, and we encourage you to review their privacy
          policies.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will update the &ldquo;Last updated&rdquo; date above and, for material changes,
          give reasonable notice through the Service or by email. Continued use
          of the Service after changes take effect constitutes acceptance of
          the revised policy.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Contact">
        <p>
          Questions, concerns, or requests about this Privacy Policy? Contact
          us at{' '}
          <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
            brenden@eeriecast.com
          </a>.
        </p>
      </LegalSection>
    </LegalDocumentModal>
  );
}

PrivacyPolicyModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
};
