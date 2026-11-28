"""Verifica o relay privado por TLS. A entrada e a saída não entram nos logs."""
from email.message import EmailMessage
import json
import smtplib
import ssl
import sys


def verify(config):
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    options = dict(host=config["host"], port=config["port"], timeout=5)
    if config["mode"] == "tls":
        client = smtplib.SMTP_SSL(**options, context=context)
    else:
        client = smtplib.SMTP(**options)
    try:
        if config["mode"] == "starttls":
            client.starttls(context=context)
        client.login(config["username"], config["password"])
        if "diagnostic" in config:
            msg = EmailMessage()
            msg["From"] = config["test_from"]
            msg["To"] = config["test_to"]
            msg["Subject"] = "V4NT Platform - teste de e-mail"
            msg["Message-ID"] = "<" + config["diagnostic"] + "@" + config["test_from"].split("@")[1] + ">"
            msg.set_content("Verificacao de envio SMTP solicitada na Central de integracoes. Referencia: " + config["diagnostic"])
            try:
                client.send_message(msg)
            except (smtplib.SMTPResponseException, smtplib.SMTPRecipientsRefused):
                return "rejected"
            except (OSError, smtplib.SMTPException):
                return "unknown"
            return "accepted"
        status, _ = client.noop()
        return "success" if status == 250 else "upstream"
    finally:
        client.close()


def main():
    try:
        result = verify(json.load(sys.stdin))
    except smtplib.SMTPAuthenticationError:
        result = "access"
    except (ssl.SSLError, smtplib.SMTPNotSupportedError):
        result = "protocol"
    except (OSError, smtplib.SMTPException):
        result = "unavailable"
    print(result)


if __name__ == "__main__":
    main()
