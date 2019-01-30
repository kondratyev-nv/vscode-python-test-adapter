
def add_failed(x, y):
    '''
    >>> add_failed(10, 20)
    30
    >>> add_failed('aaa', 'bbb')
    'aaabbb'
    >>> add_failed('aaa', 20)
    'aaa20'
    '''
    return x + y

def mul_passed(x, y):
    '''
    >>> mul_passed(10, 20)
    200
    >>> mul_passed('aaa', 10)
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    >>> mul_passed('aaa', 'bbb')
    Traceback (most recent call last):
    ...
    TypeError: can't multiply sequence by non-int of type 'str'
    '''
    return x * y
