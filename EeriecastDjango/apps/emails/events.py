from __future__ import annotations

import uuid

from django.core.signing import TimestampSigner

from .service import enqueue_event_email, make_app_url


VERIFY_EMAIL_SALT = "email-verify"
EMAIL_CHANGE_SALT = "email-change"


class EmailEventTypes:
    ACCOUNT_CREATED_VERIFY = "ACCOUNT_CREATED_VERIFY"
    ACCOUNT_VERIFIED = "ACCOUNT_VERIFIED"
    PASSWORD_RESET_LINK = "PASSWORD_RESET_LINK"
    EMAIL_CHANGED_OLD = "EMAIL_CHANGED_OLD"
    EMAIL_CHANGED_NEW = "EMAIL_CHANGED_NEW"
    ACCOUNT_DELETED_CONFIRMATION = "ACCOUNT_DELETED_CONFIRMATION"
    EMAIL_CHANGE_VERIFY = "EMAIL_CHANGE_VERIFY"
    EMAIL_CHANGE_REQUESTED_OLD = "EMAIL_CHANGE_REQUESTED_OLD"

    SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED"
    PAYMENT_SUCCEEDED = "PAYMENT_SUCCEEDED"
    PAYMENT_FAILED = "PAYMENT_FAILED"
    DEFAULT_PAYMENT_METHOD_CHANGED = "DEFAULT_PAYMENT_METHOD_CHANGED"
    SUBSCRIPTION_CANCELLED_OR_EXPIRED = "SUBSCRIPTION_CANCELLED_OR_EXPIRED"
    RENEWAL_REMINDER_7_DAYS = "RENEWAL_REMINDER_7_DAYS"


def _sign_verify_token(user_id: int) -> str:
    signer = TimestampSigner(salt=VERIFY_EMAIL_SALT)
    return signer.sign(str(user_id))


def send_account_created_verify(*, user_id: int, to_email: str):
    token = _sign_verify_token(user_id)
    verify_url = make_app_url(f"/verify-email?token={token}")
    enqueue_event_email(
        event_type=EmailEventTypes.ACCOUNT_CREATED_VERIFY,
        to_email=to_email,
        external_id=f"user:{user_id}:account_created",
        subject="Welcome to Eeriecast — verify your email",
        template_name="emails/account_created_verify.html",
        context={
            "verify_url": verify_url,
        },
        user_id=user_id,
    )


def send_account_verified(*, user_id: int, to_email: str):
    enqueue_event_email(
        event_type=EmailEventTypes.ACCOUNT_VERIFIED,
        to_email=to_email,
        external_id=f"user:{user_id}:verified",
        subject="Your Eeriecast email is verified",
        template_name="emails/account_verified.html",
        context={
            "login_url": make_app_url("/login"),
        },
        user_id=user_id,
    )


def send_password_reset_link(*, user_id: int | None, to_email: str, reset_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.PASSWORD_RESET_LINK,
        to_email=to_email,
        external_id=f"pwdreset:{uuid.uuid4()}",
        subject="Reset your Eeriecast password",
        template_name="emails/password_reset.html",
        context={
            "reset_url": reset_url,
        },
        user_id=user_id,
    )


def send_email_changed_notifications(*, user_id: int, old_email: str, new_email: str):
    change_id = uuid.uuid4()
    enqueue_event_email(
        event_type=EmailEventTypes.EMAIL_CHANGED_OLD,
        to_email=old_email,
        external_id=f"user:{user_id}:email_changed:{change_id}:old",
        subject="Your Eeriecast email was changed",
        template_name="emails/email_changed_old.html",
        context={
            "old_email": old_email,
            "new_email": new_email,
        },
        user_id=user_id,
    )
    enqueue_event_email(
        event_type=EmailEventTypes.EMAIL_CHANGED_NEW,
        to_email=new_email,
        external_id=f"user:{user_id}:email_changed:{change_id}:new",
        subject="Your Eeriecast email has been updated",
        template_name="emails/email_changed_new.html",
        context={
            "new_email": new_email,
        },
        user_id=user_id,
    )


def send_account_deleted_confirmation(*, user_id: int, to_email: str, deleted_at_iso: str, deleted_at_display: str):
    enqueue_event_email(
        event_type=EmailEventTypes.ACCOUNT_DELETED_CONFIRMATION,
        to_email=to_email,
        external_id=f"user:{user_id}:deleted:{uuid.uuid4()}",
        subject="Your Eeriecast account was deleted",
        template_name="emails/account_deleted.html",
        context={
            "deleted_at": deleted_at_iso,
            "deleted_at_display": deleted_at_display,
        },
        user_id=user_id,
    )


def send_email_change_verification(*, user_id: int, to_email: str, new_email: str, verify_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.EMAIL_CHANGE_VERIFY,
        to_email=to_email,
        external_id=f"user:{user_id}:email_change_verify:{uuid.uuid4()}",
        subject="Confirm your new Eeriecast email",
        template_name="emails/email_change_verify.html",
        context={
            "new_email": new_email,
            "verify_url": verify_url,
        },
        user_id=user_id,
    )


def send_email_change_requested_old(*, user_id: int, to_email: str, new_email: str):
    enqueue_event_email(
        event_type=EmailEventTypes.EMAIL_CHANGE_REQUESTED_OLD,
        to_email=to_email,
        external_id=f"user:{user_id}:email_change_requested:{uuid.uuid4()}",
        subject="Email change requested",
        template_name="emails/email_change_requested_old.html",
        context={
            "new_email": new_email,
        },
        user_id=user_id,
    )


def send_subscription_created(*, user_id: int, to_email: str, external_id: str, plan_name: str, period_end: str, manage_billing_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.SUBSCRIPTION_CREATED,
        to_email=to_email,
        external_id=external_id,
        subject="Your premium membership is active",
        template_name="emails/subscription_created.html",
        context={
            "plan_name": plan_name,
            "period_end": period_end,
            "manage_billing_url": manage_billing_url,
        },
        user_id=user_id,
    )


def send_payment_succeeded(*, user_id: int, to_email: str, external_id: str, amount: str, invoice_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.PAYMENT_SUCCEEDED,
        to_email=to_email,
        external_id=external_id,
        subject="Payment received",
        template_name="emails/payment_succeeded.html",
        context={
            "amount": amount,
            "invoice_url": invoice_url,
        },
        user_id=user_id,
    )


def send_payment_failed(*, user_id: int, to_email: str, external_id: str, amount: str, manage_billing_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.PAYMENT_FAILED,
        to_email=to_email,
        external_id=external_id,
        subject="Payment failed — action required",
        template_name="emails/payment_failed.html",
        context={
            "amount": amount,
            "manage_billing_url": manage_billing_url,
        },
        user_id=user_id,
    )


def send_default_payment_method_changed(*, user_id: int, to_email: str, external_id: str, payment_method_summary: str, manage_billing_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.DEFAULT_PAYMENT_METHOD_CHANGED,
        to_email=to_email,
        external_id=external_id,
        subject="Your default payment method was updated",
        template_name="emails/default_payment_method_changed.html",
        context={
            "payment_method_summary": payment_method_summary,
            "manage_billing_url": manage_billing_url,
        },
        user_id=user_id,
    )


def send_subscription_cancelled_or_expired(*, user_id: int, to_email: str, external_id: str, effective_end: str, manage_billing_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.SUBSCRIPTION_CANCELLED_OR_EXPIRED,
        to_email=to_email,
        external_id=external_id,
        subject="Your premium membership has ended",
        template_name="emails/subscription_cancelled.html",
        context={
            "effective_end": effective_end,
            "manage_billing_url": manage_billing_url,
        },
        user_id=user_id,
    )


def send_renewal_reminder_7_days(*, user_id: int, to_email: str, external_id: str, renewal_date: str, manage_billing_url: str):
    enqueue_event_email(
        event_type=EmailEventTypes.RENEWAL_REMINDER_7_DAYS,
        to_email=to_email,
        external_id=external_id,
        subject="Your membership renews soon",
        template_name="emails/renewal_reminder.html",
        context={
            "renewal_date": renewal_date,
            "manage_billing_url": manage_billing_url,
        },
        user_id=user_id,
    )
