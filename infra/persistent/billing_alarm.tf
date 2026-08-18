# -----------------------------------------------------------------------------
# CloudWatch Billing Alarm & Budget Guardrail
# Note: Billing metrics are only available in us-east-1
# -----------------------------------------------------------------------------
resource "aws_sns_topic" "billing_alerts" {
  count = var.billing_alert_email != "" ? 1 : 0
  name  = "${var.project_name}-billing-alerts"

  tags = {
    Name = "${var.project_name}-billing-alerts"
  }
}

resource "aws_sns_topic_subscription" "billing_alerts_email" {
  count     = var.billing_alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.billing_alerts[0].arn
  protocol  = "email"
  endpoint  = var.billing_alert_email
}

resource "aws_cloudwatch_metric_alarm" "billing_alarm_20" {
  alarm_name          = "${var.project_name}-estimated-charges-exceeded-20usd"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 21600 # 6 hours
  statistic           = "Maximum"
  threshold           = 20
  alarm_description   = "Alarm when AWS estimated charges exceed $20"

  dimensions = {
    Currency = "USD"
  }

  alarm_actions = var.billing_alert_email != "" ? [aws_sns_topic.billing_alerts[0].arn] : []
}

resource "aws_cloudwatch_metric_alarm" "billing_alarm_50" {
  alarm_name          = "${var.project_name}-estimated-charges-exceeded-50usd"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 21600
  statistic           = "Maximum"
  threshold           = 50
  alarm_description   = "Alarm when AWS estimated charges exceed $50"

  dimensions = {
    Currency = "USD"
  }

  alarm_actions = var.billing_alert_email != "" ? [aws_sns_topic.billing_alerts[0].arn] : []
}
