from django import forms
from django.utils.safestring import mark_safe

EMOJIS = ['🌿', '🌸', '🌱', '🌻', '🪴', '🌷', '🌵', '🍀', '🌺']


class PatternPickerWidget(forms.TextInput):
    """
    ویجت انتخابگر بصری الگو.
    به جای تایپ "1,5,9"، کاربر روی ایموجی‌ها کلیک می‌کند.
    مقدار نهایی به‌صورت "1,5,9" در input مخفی ذخیره می‌شود.
    """

    def render(self, name, value, attrs=None, renderer=None):
        attrs = attrs or {}
        widget_id = attrs.get('id') or f'id_{name}'

        # مقادیر فعلی
        current = set()
        if value:
            for x in str(value).split(','):
                x = x.strip()
                if x.isdigit():
                    n = int(x)
                    if 1 <= n <= 9:
                        current.add(n)

        # ساخت دکمه‌ها
        buttons = []
        for i, emoji in enumerate(EMOJIS, 1):
            cls = 'gp-btn selected' if i in current else 'gp-btn'
            buttons.append(
                f'<button type="button" class="{cls}" data-index="{i}" '
                f'title="دکمه {i}">{emoji}</button>'
            )

        input_html = (
            f'<input type="text" name="{name}" id="{widget_id}" '
            f'value="{value or ""}" class="gp-hidden" autocomplete="off" '
            f'style="display:none">'
        )

        html = (
            f'<div class="gp-picker" id="{widget_id}_picker">'
            f'{input_html}'
            f'<div class="gp-grid">{"".join(buttons)}</div>'
            f'<div class="gp-hint">'
            f'<span class="gp-info">🔒 روی دکمه‌ها بزن تا انتخاب یا لغو کنی</span>'
            f'<span class="gp-count">تعداد انتخاب: <b>{len(current)}</b></span>'
            f'</div>'
            f'<div class="gp-preview" style="display:none"></div>'
            f'</div>'
        )
        return mark_safe(html)
