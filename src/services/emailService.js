import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export const sendConfirmationEmail = async ({ name, email, service, caseId }) => {
  try {
    const finalCaseId = caseId || "N/A";

    await addDoc(collection(db, "mail"), {
      to: email,
      message: {
        subject: `${service || "Application"} Submitted Successfully ✅ | ID: ${finalCaseId}`,
        html: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; background:#f4f6f8; padding:20px;">
  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">

   <div style="background:linear-gradient(135deg,#0f172a,#1e293b); padding:25px; border-radius:12px 12px 0 0;">

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      
      <!-- LOGO -->
      <td style="vertical-align:middle; width:150px;">
        <div style="background:#ffffff; padding:6px 10px; border-radius:10px; display:inline-block;">
          <img 
            src="https://firebasestorage.googleapis.com/v0/b/regibiz2026.firebasestorage.app/o/WhatsApp%20Image%202026-04-08%20at%206.22.59%20PM.jpeg?alt=media&token=fe50b7f7-d6a4-4dc0-a60a-d641fabb9df3"
            alt="RegiBiz"
            style="width:120px; display:block; border-radius:6px;"
          />
        </div>
      </td>

      <!-- TEXT -->
      <td style="vertical-align:middle;">
        <p style="color:#ffffff; font-size:16px; margin:0; font-weight:600;">
                Business Compliance Platform
        </p>
       
      </td>

    </tr>
  </table>

</div>

    <!-- BODY -->
    <div style="padding:28px;">
      <h2 style="color:#111827; margin-bottom:10px;">
        Hello ${name || "User"},
      </h2>

      <p style="color:#374151; font-size:14px; line-height:1.7;">
        Your <b style="color:#2563eb;">${service || "application"}</b> has been successfully submitted.
        Our team has received your request and will begin processing it shortly.
      </p>

      <!-- APPLICATION ID -->
      <div style="background:#ecfeff; border:1px dashed #06b6d4; padding:16px; border-radius:8px; margin:22px 0; text-align:center;">
        <p style="margin:0; font-size:13px; color:#0f172a;">Application ID</p>
        <p style="margin:6px 0 0; font-size:18px; font-weight:bold; color:#06b6d4;">
          ${finalCaseId}
        </p>
      </div>

      <div style="background:#f1f5f9; border-radius:8px; padding:15px; margin:20px 0;">
        <p style="margin:0; font-size:14px; color:#475569;">
          📌 Our team will review your application and contact you within 24–48 hours.
        </p>
      </div>

      <!-- CTA BUTTON -->
      <div style="text-align:center; margin:28px 0;">
        <a href="https://regibiz.cloudmasa.com"
           style="background:#2563eb; color:#ffffff; padding:12px 26px;
                  text-decoration:none; border-radius:6px; font-size:14px;
                  font-weight:500; display:inline-block;">
          View Dashboard
        </a>
      </div>

      <!-- SUPPORT SECTION -->
      <div style="margin-top:25px;">
        <p style="color:#6b7280; font-size:13px; margin-bottom:10px;">
          If you have any questions, feel free to reach out to our support team:
        </p>

        <div style="background:#f9fafb; border:1px solid #e5e7eb; padding:15px; border-radius:8px;">
          <p style="margin:0; font-size:13px;">
            📧 Email: 
            <a href="mailto:support@cloudmasa.com" style="color:#2563eb; text-decoration:none;">
              support@cloudmasa.com
            </a>
          </p>

          <p style="margin:8px 0 0; font-size:13px;">
            📞 Phone: 
            <a href="tel:+916364562818" style="color:#2563eb; text-decoration:none;">
              +91 63645 62818
            </a>
          </p>
        </div>
      </div>

      <p style="color:#6b7280; font-size:12px; margin-top:20px;">
        Please save your Application ID for future reference.
      </p>

    </div>

    <!-- FOOTER -->
    <div style="background:#0f172a; padding:18px; text-align:center;">
      <p style="color:#cbd5f5; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} RegiBiz · CloudMaSa Innovation Lab Pvt Ltd
      </p>
      <p style="color:#64748b; font-size:11px; margin-top:6px;">
        This is an automated email. Please do not reply directly to this message.
      </p>
    </div>

  </div>
</div>
`
      }
    });

  } catch (error) {
    console.error("Email error:", error);
  }
};