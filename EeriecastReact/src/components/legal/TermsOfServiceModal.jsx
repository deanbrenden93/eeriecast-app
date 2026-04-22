import React from 'react';
import PropTypes from 'prop-types';
import LegalDocumentModal, {
  LegalSection,
  LegalSubheading,
  LegalList,
} from './LegalDocumentModal';

const LAST_UPDATED = 'April 22, 2026';

export default function TermsOfServiceModal({ open, onOpenChange }) {
  return (
    <LegalDocumentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
    >
      <p className="text-[13.5px] leading-relaxed text-zinc-300 mb-6">
        Eeriecast is a horror podcast network dedicated to storytelling and folklore.
        These Terms of Service (the &ldquo;Terms&rdquo;) govern your access to and use of
        the Eeriecast mobile and web applications, website, and related services
        (collectively, the &ldquo;Service&rdquo;) operated by <strong>Eeriecast, LLC</strong>
        (&ldquo;Eeriecast,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By creating an account or using
        the Service, you agree to be bound by these Terms. If you do not agree,
        do not use the Service.
      </p>

      <LegalSection number="1" title="Eligibility">
        <p>
          You must be at least 13 years old to create an account. Certain content
          on the Service is designated as &ldquo;Mature&rdquo; and is only available to
          users who verify they are at least 18 years old and have enabled mature
          content in their settings. By using the Service you represent that the
          information you provide (including your date of birth) is accurate.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Your Account">
        <p>
          You are responsible for maintaining the confidentiality of your login
          credentials and for all activity that occurs under your account. You
          agree to notify us immediately at{' '}
          <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
            brenden@eeriecast.com
          </a>{' '}
          of any unauthorized use. We may suspend or terminate accounts that
          violate these Terms or that we reasonably believe are engaged in
          fraudulent, abusive, or unlawful activity.
        </p>
      </LegalSection>

      <LegalSection number="3" title="The Service">
        <p>
          The Service allows you to stream horror podcasts, audiobooks, and other
          audio content; follow shows; build playlists; favorite episodes; track
          listening history; and, for Premium members, access exclusive content
          and ad-free listening. We may add, modify, or remove features at any
          time without notice.
        </p>
      </LegalSection>

      <LegalSection number="4" title="Subscriptions, Free Trials, and Billing">
        <LegalSubheading>Premium Subscriptions</LegalSubheading>
        <p>
          Eeriecast offers paid Premium subscriptions on a recurring monthly or
          annual basis. Pricing is displayed within the Service at the time of
          purchase. Subscriptions automatically renew at the end of each billing
          period at the then-current rate unless you cancel before the renewal
          date.
        </p>

        <LegalSubheading>Free Trial</LegalSubheading>
        <p>
          New Premium subscribers are typically offered a 7-day free trial. You
          will be asked for a valid payment method to start the trial. If you do
          not cancel before the trial ends, you will be automatically charged for
          a recurring Premium subscription. You can cancel at any time from the
          Billing &amp; Subscription screen.
        </p>

        <LegalSubheading>Legacy Free Trials (Imported Members)</LegalSubheading>
        <p>
          Members migrated from our previous platform may be granted an extended
          complimentary trial (30 days for previous monthly members; 365 days for
          previous annual members) while you transition to the new Service. When
          the legacy trial ends you may subscribe to a regular Premium plan to
          continue accessing Premium content.
        </p>

        <LegalSubheading>Payment Processing</LegalSubheading>
        <p>
          Payments are processed by <strong>Stripe, Inc.</strong> We do not store
          your full credit card details on our servers. By providing a payment
          method, you authorize us (through Stripe) to charge that method for all
          fees incurred.
        </p>

        <LegalSubheading>Refunds</LegalSubheading>
        <p>
          Except where required by applicable law, all charges are final and
          non-refundable. If you believe you were charged in error, contact{' '}
          <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
            brenden@eeriecast.com
          </a>.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Acceptable Use">
        <p>You agree not to, and not to attempt to:</p>
        <LegalList>
          <li>Download, copy, rip, mirror, or redistribute any audio or other content from the Service except as expressly permitted;</li>
          <li>Circumvent, disable, or interfere with any digital rights management, access control, or security features of the Service;</li>
          <li>Use the Service to harass, threaten, defame, or harm any person or group;</li>
          <li>Share your account credentials or allow anyone else to use your account;</li>
          <li>Use bots, scrapers, or automated means to access or collect data from the Service;</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the Service, except to the limited extent allowed by law.</li>
        </LegalList>
      </LegalSection>

      <LegalSection number="6" title="Content and Intellectual Property">
        <p>
          All podcasts, audiobooks, episodes, artwork, music, logos, trademarks,
          software, and other content made available through the Service are the
          property of Eeriecast, LLC, its licensors, creators, or other rights
          holders, and are protected by copyright, trademark, and other
          intellectual-property laws. We grant you a limited, non-exclusive,
          non-transferable, revocable license to stream and interact with this
          content for personal, non-commercial use through the Service.
        </p>
        <p>
          You may not record, rebroadcast, redistribute, sell, or publicly
          perform any content from the Service without prior written permission.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Explicit Language">
        <p>
          Eeriecast publishes horror content that may include depictions of
          violence, the supernatural, psychological distress, and other themes
          intended for older audiences. Some shows contain language not suitable
          for younger audiences and require you to enable &ldquo;Explicit
          Language&rdquo; on your account (from Settings or your Profile) before
          they will play. Enabling this setting requires you to confirm that
          you are at least 18 years old. You acknowledge that you access such
          content voluntarily and at your own discretion.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Third-Party Services">
        <p>
          The Service relies on third-party providers (including, for example,
          Stripe for payment processing and cloud hosting providers for content
          delivery). Your use of those services is also subject to their
          respective terms and privacy policies. We are not responsible for the
          practices of third parties.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Termination">
        <p>
          You may stop using the Service at any time and may delete your account
          by contacting{' '}
          <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
            brenden@eeriecast.com
          </a>. We may suspend or terminate your access to the Service at any
          time, with or without notice, if we reasonably believe you have
          violated these Terms, abused the Service, or created risk or possible
          legal exposure for Eeriecast.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Disclaimers">
        <p className="uppercase text-zinc-400 text-[12.5px] tracking-wide">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
          of any kind, whether express or implied, including warranties of
          merchantability, fitness for a particular purpose, non-infringement, or
          uninterrupted or error-free operation. Eeriecast does not warrant that
          the Service will always be secure, available, or accurate.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Limitation of Liability">
        <p className="uppercase text-zinc-400 text-[12.5px] tracking-wide">
          To the maximum extent permitted by law, Eeriecast, LLC and its
          officers, employees, contractors, and licensors will not be liable for
          any indirect, incidental, special, consequential, exemplary, or
          punitive damages, or any loss of profits, revenues, data, or goodwill,
          arising out of or related to your use of the Service. Our aggregate
          liability for any claim arising out of these Terms or the Service will
          not exceed the greater of (a) the amount you paid us in the twelve (12)
          months preceding the claim or (b) USD $50.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Indemnification">
        <p>
          You agree to defend, indemnify, and hold harmless Eeriecast, LLC and
          its officers, employees, and contractors from any claim, demand, loss,
          or expense (including reasonable attorneys&apos; fees) arising out of
          your use of the Service, your violation of these Terms, or your
          violation of any law or the rights of a third party.
        </p>
      </LegalSection>

      <LegalSection number="13" title="Governing Law and Dispute Resolution">
        <p>
          These Terms are governed by the laws of the United States and the
          state in which Eeriecast, LLC is organized, without regard to its
          conflict-of-laws principles. You agree that any dispute arising out of
          or relating to these Terms or the Service will be resolved exclusively
          in the state or federal courts located in that jurisdiction, and you
          consent to personal jurisdiction in those courts.
        </p>
      </LegalSection>

      <LegalSection number="14" title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. When we do, we will
          update the &ldquo;Last updated&rdquo; date above and, for material changes, give
          reasonable notice through the Service or by email. Continued use of
          the Service after changes take effect constitutes acceptance of the
          revised Terms.
        </p>
      </LegalSection>

      <LegalSection number="15" title="Contact">
        <p>
          Questions or concerns about these Terms or the Service? Contact us at{' '}
          <a href="mailto:brenden@eeriecast.com" className="text-red-400 hover:text-red-300 underline decoration-red-500/30">
            brenden@eeriecast.com
          </a>.
        </p>
      </LegalSection>
    </LegalDocumentModal>
  );
}

TermsOfServiceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
};
