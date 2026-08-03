import warnings
import openpyxl


def load_workbook_safely(path, data_only=True, **kwargs):
    """Load an Excel workbook while suppressing a known openpyxl Data Validation warning."""
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Data Validation extension is not supported and will be removed",
            category=UserWarning,
            module=r"openpyxl\.worksheet\._reader",
        )
        return openpyxl.load_workbook(path, data_only=data_only, **kwargs)
