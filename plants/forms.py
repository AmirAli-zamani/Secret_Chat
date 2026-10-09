from django import forms
from .models import AdminPattern
from .widgets import PatternPickerWidget


class AdminPatternForm(forms.ModelForm):
    class Meta:
        model = AdminPattern
        fields = ['pattern']
        widgets = {
            'pattern': PatternPickerWidget(),
        }
        labels = {
            'pattern': 'الگوی امنیتی',
        }
        help_texts = {
            'pattern': 'روی ایموجی‌ها کلیک کن. حداقل ۲ و حداکثر ۹ دکمه.',
        }

    def clean_pattern(self):
        value = self.cleaned_data.get('pattern', '') or ''
        parts = [x.strip() for x in value.split(',') if x.strip()]
        nums = []
        for p in parts:
            if not p.isdigit():
                raise forms.ValidationError('فقط اعداد ۱ تا ۹ مجاز هستند.')
            n = int(p)
            if not (1 <= n <= 9):
                raise forms.ValidationError('اعداد باید بین ۱ تا ۹ باشند.')
            nums.append(n)
        if len(nums) < 2:
            raise forms.ValidationError('حداقل ۲ دکمه باید انتخاب شود.')
        if len(nums) > 9:
            raise forms.ValidationError('حداکثر ۹ دکمه مجاز است.')
        return ','.join(str(n) for n in sorted(set(nums)))
