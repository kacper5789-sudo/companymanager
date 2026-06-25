-- 190_daily_report_sms_email_counts_fix.sql
-- Informacyjnie: raport dzienny liczy SMS/Email z notification_logs oraz ręczne kampanie email z marketing_campaign_recipients.
notify pgrst, 'reload schema';
